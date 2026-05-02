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

const readData = () => {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { password: null, checks: [], incidents: [] };
  }
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
};

const ensureAuth = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.status(401).json({ error: "Unauthorized" });
};

app.post("/api/login", async (req, res) => {
  const { password } = req.body;
  const data = readData();

  if (!data.password) {
    return res.status(401).json({ success: false, error: "Setup required" });
  }

  const isMatch = await bcrypt.compare(password, data.password);
  if (isMatch) {
    req.session.loggedIn = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
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

app.get("/api/status", async (req, res) => {
  const data = readData();
  const forceRefresh = req.query.force === "true";
  const now = Date.now();
  const CACHE_TIME = 5 * 60 * 1000;

  if (forceRefresh && data.last_update && now - data.last_update < 30000) {
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
      incidents: data.incidents || [],
      outagesCount: data.cached_outagesCount,
      last_update: data.last_update,
    });
  }

  const results = [];
  let outagesCount = 0;

  const checks = data.checks || [];
  for (const item of checks) {
    let isUp = false;
    let current_code = "";

    try {
      if (item.type === "manual") {
        isUp = item.manual_status === "up";
        current_code = isUp ? "OK" : "Awaria";
      } else if (item.type === "http") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(item.host, {
            method: "GET",
            signal: controller.signal,
            headers: { "User-Agent": "StatusPage/1.0" },
          });
          clearTimeout(timeoutId);
          isUp = response.status === 200;
          current_code = response.status.toString();
        } catch (err) {
          isUp = false;
          current_code = "Błąd/Timeout";
        }
      } else if (item.type === "ping") {
        try {
          execSync(`ping -c 1 -W 5 ${item.host}`, { stdio: "ignore" });
          isUp = true;
        } catch (e) {
          isUp = false;
          current_code = "Host nieosiągalny";
        }
      } else if (item.type === "port") {
        try {
          const parts = item.host.split(" ");
          execSync(`nc -z -w 5 ${parts[0]} ${parts[1]}`, { stdio: "ignore" });
          isUp = true;
        } catch (e) {
          isUp = false;
          current_code = "Port zamknięty";
        }
      }
    } catch (e) {
      isUp = false;
      current_code = "Error";
    }

    if (!isUp) outagesCount++;

    results.push({
      group: item.group,
      name: item.name,
      status: isUp ? "success" : "failed",
    });
  }

  data.cached_checks = results;
  data.cached_outagesCount = outagesCount;
  data.last_update = now;
  writeData(data);

  res.json({
    checks: results,
    incidents: data.incidents || [],
    outagesCount,
    last_update: now,
  });
});

app.get("/api/data", ensureAuth, (req, res) => {
  res.json(readData());
});

app.post("/api/data", ensureAuth, (req, res) => {
  const newData = req.body;
  const currentData = readData();
  newData.password = currentData.password;
  writeData(newData);
  res.json({ success: true });
});

app.post("/api/password", ensureAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (newPassword) {
    const data = readData();
    data.password = await bcrypt.hash(newPassword, 10);
    writeData(data);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Statuspage running on http://localhost:${PORT}`);
});
