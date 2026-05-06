const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const bcrypt = require("bcrypt");

const app = express();
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "config.json");
const CACHE_TIME = 5 * 60 * 1000;
const RATE_LIMIT = 30000;
const DEFAULT_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(bodyParser.json());
app.use(express.static("public"));
app.use(
  session({
    secret: "tinystatus_secret_key",
    resave: false,
    saveUninitialized: true,
  }),
);

app.get("/panel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel.html"));
});

// --- Data helpers ---

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      password: null,
      checks: [],
      outages: [],
      timezone: DEFAULT_TIMEZONE,
      ...data,
      checks: Array.isArray(data.checks) ? data.checks : [],
      outages: Array.isArray(data.outages) ? data.outages : [],
      timezone: data.timezone || DEFAULT_TIMEZONE,
    };
  } catch {
    return {
      password: null,
      checks: [],
      outages: [],
      timezone: DEFAULT_TIMEZONE,
    };
  }
}

function writeData(data) {
  const normalized = {
    password: null,
    checks: [],
    outages: [],
    timezone: DEFAULT_TIMEZONE,
    ...data,
    checks: Array.isArray(data.checks) ? data.checks : [],
    outages: Array.isArray(data.outages) ? data.outages : [],
    timezone: data.timezone || DEFAULT_TIMEZONE,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), "utf8");
}

function sanitizeData(data) {
  const { password, ...safeData } = data;
  return safeData;
}

// --- Auth middleware ---

function ensureAuth(req, res, next) {
  if (req.session.loggedIn) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// --- Auth routes ---

app.post("/api/login", async (req, res) => {
  const { password } = req.body;
  const data = readData();

  if (!data.password) {
    return res.status(401).json({ success: false, error: "Setup required" });
  }

  const isMatch = await bcrypt.compare(password, data.password);
  if (isMatch) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

app.post("/api/setup", async (req, res) => {
  const { password } = req.body;

  if (!password || password.trim() === "") {
    return res
      .status(400)
      .json({ success: false, error: "Password cannot be empty" });
  }

  const data = readData();
  if (data.password) {
    return res.status(400).json({ success: false, error: "Already setup" });
  }

  data.password = await bcrypt.hash(password, 10);
  data.timezone = data.timezone || DEFAULT_TIMEZONE;
  writeData(data);
  req.session.loggedIn = true;
  res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get("/api/checkAuth", (req, res) => {
  const data = readData();
  res.json({ loggedIn: !!req.session.loggedIn, needsSetup: !data.password });
});

// --- Status check logic ---

async function runCheck(item) {
  if (item.type === "manual") {
    return item.manual_status === "up";
  }

  if (item.type === "http") {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(item.host, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "StatusPage/1.0" },
      });
      clearTimeout(timeoutId);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  if (item.type === "ping") {
    try {
      execSync(`ping -c 1 -W 5 ${item.host}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  if (item.type === "port") {
    try {
      const parts = item.host.split(" ");
      execSync(`nc -z -w 5 ${parts[0]} ${parts[1]}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

app.get("/api/status", async (req, res) => {
  const data = readData();
  const forceRefresh = req.query.force === "true";
  const now = Date.now();

  if (forceRefresh && data.last_update && now - data.last_update < RATE_LIMIT) {
    return res.status(429).json({ error: "Too many requests" });
  }

  if (
    !forceRefresh &&
    data.last_update &&
    now - data.last_update < CACHE_TIME &&
    data.cached_checks
  ) {
    return res.json({
      checks: data.cached_checks,
      outages: data.outages || [],
      outagesCount: data.cached_outagesCount,
      last_update: data.last_update,
      timezone: data.timezone || DEFAULT_TIMEZONE,
    });
  }

  const results = [];
  let outagesCount = 0;

  for (const item of data.checks || []) {
    const isUp = await runCheck(item);
    if (!isUp) outagesCount++;

    results.push({
      group: item.group,
      name: item.name,
      status: isUp ? "success" : "failed",
      url: item.host || "",
    });
  }

  data.cached_checks = results;
  data.cached_outagesCount = outagesCount;
  data.last_update = now;
  writeData(data);

  res.json({
    checks: results,
    outages: data.outages || [],
    outagesCount,
    last_update: now,
    timezone: data.timezone || DEFAULT_TIMEZONE,
  });
});

// --- Admin data routes ---

app.get("/api/data", ensureAuth, (req, res) => {
  res.json(sanitizeData(readData()));
});

app.post("/api/data", ensureAuth, (req, res) => {
  const newData = req.body;
  const currentData = readData();
  newData.outages = Array.isArray(newData.outages) ? newData.outages : [];

  const hasInvalidOutageDates = newData.outages.some((outage) => {
    if (!outage?.date || !outage?.endDate) return false;
    return new Date(outage.endDate) <= new Date(outage.date);
  });

  if (hasInvalidOutageDates) {
    return res.status(400).json({
      success: false,
      error: "End date must be later than start date",
    });
  }

  newData.password = currentData.password;
  newData.timezone =
    newData.timezone || currentData.timezone || DEFAULT_TIMEZONE;

  delete newData.cached_checks;
  delete newData.cached_outagesCount;
  delete newData.last_update;

  writeData(newData);
  res.json({ success: true });
});

app.post("/api/password", ensureAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ success: false });
  }
  const data = readData();
  data.password = await bcrypt.hash(newPassword, 10);
  writeData(data);
  res.json({ success: true });
});

// --- Favicon ---

app.get("/favicon.ico", (req, res) => {
  const data = readData();
  const emoji = data.cached_outagesCount > 0 ? "🔴" : "🟢";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text y="27" font-size="27">${emoji}</text></svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.send(svg);
});

// --- Start ---

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Statuspage running on http://localhost:${PORT}`);
});
