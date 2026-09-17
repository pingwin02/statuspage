const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { EventEmitter } = require("events");
const util = require("util");
const bcrypt = require("bcrypt");

const execAsync = util.promisify(exec);
const statusEmitter = new EventEmitter();

const app = express();
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "config.json");
const CACHE_TIME = 5 * 60 * 1000;
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
  cancelCurrentRefresh();
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

async function runCheck(item, signal) {
  if (item.type === "manual") {
    return item.manual_status === "up";
  }

  if (item.type === "http") {
    if (signal?.aborted) return false;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(item.host, {
        method: "GET",
        signal: controller.signal,
        headers: { "User-Agent": "StatusPage/1.0" },
      });
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      return response.status === 200;
    } catch {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      return false;
    }
  }

  if (item.type === "ping") {
    if (signal?.aborted) return false;
    try {
      await execAsync(`ping -c 1 -W 5 ${item.host}`, { signal });
      return true;
    } catch {
      return false;
    }
  }

  if (item.type === "port") {
    if (signal?.aborted) return false;
    try {
      const parts = item.host.split(" ");
      await execAsync(`nc -z -w 5 ${parts[0]} ${parts[1]}`, { signal });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

let isRefreshing = false;
let refreshAbortController = null;
let refreshPromise = null;
let activeChecks = null;
let activeOutagesCount = 0;

function cancelCurrentRefresh() {
  if (refreshAbortController) {
    refreshAbortController.abort();
    refreshAbortController = null;
  }
  isRefreshing = false;
  refreshPromise = null;
  activeChecks = null;
}

function getInitialCheckState(item) {
  const isManual = item.type === "manual";
  const manualUp = item.manual_status === "up";
  return {
    group: item.group,
    name: item.name,
    type: item.type || "http",
    status: isManual ? (manualUp ? "success" : "failed") : "checking",
    url: item.host || "",
    is_checking: !isManual,
  };
}

async function executeChecks(checks, signal) {
  const total = (checks || []).length;
  let completed = 0;
  activeChecks = (checks || []).map(getInitialCheckState);
  activeOutagesCount = activeChecks.filter((c) => c.status === "failed").length;

  const checkPromises = (checks || []).map(async (item, index) => {
    if (signal?.aborted) return null;
    const isUp =
      item.type === "manual"
        ? item.manual_status === "up"
        : await runCheck(item, signal);
    if (signal?.aborted) return null;

    const result = {
      group: item.group,
      name: item.name,
      type: item.type || "http",
      status: isUp ? "success" : "failed",
      url: item.host || "",
      is_checking: false,
    };

    if (activeChecks) {
      activeChecks[index] = result;
      completed++;
      activeOutagesCount = activeChecks.filter(
        (c) => c.status === "failed",
      ).length;

      statusEmitter.emit("check_updated", {
        index,
        check: result,
        outagesCount: activeOutagesCount,
        completed,
        total,
      });
    }

    return { isUp, result };
  });

  const resolved = await Promise.all(checkPromises);
  if (signal?.aborted) {
    return null;
  }

  const results = [];
  let outagesCount = 0;

  for (const entry of resolved) {
    if (!entry) continue;
    if (!entry.isUp) outagesCount++;
    results.push(entry.result);
  }

  activeChecks = results;
  activeOutagesCount = outagesCount;

  return { results, outagesCount };
}

function triggerBackgroundRefresh() {
  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshAbortController = new AbortController();
  const currentSignal = refreshAbortController.signal;

  const initialData = readData();
  activeChecks = (initialData.checks || []).map(getInitialCheckState);
  activeOutagesCount = activeChecks.filter((c) => c.status === "failed").length;

  refreshPromise = (async () => {
    try {
      const dataAtStart = readData();
      statusEmitter.emit("refresh_started", {
        total: (dataAtStart.checks || []).length,
      });

      const outcome = await executeChecks(dataAtStart.checks, currentSignal);
      if (currentSignal.aborted || !outcome) {
        return;
      }

      const { results, outagesCount } = outcome;
      const currentData = readData();
      currentData.cached_checks = results;
      currentData.cached_outagesCount = outagesCount;
      currentData.last_update = Date.now();
      writeData(currentData);

      statusEmitter.emit("done", {
        checks: results,
        outagesCount,
        last_update: currentData.last_update,
      });
    } catch {
    } finally {
      if (refreshAbortController?.signal === currentSignal) {
        refreshAbortController = null;
        isRefreshing = false;
        refreshPromise = null;
        activeChecks = null;
      }
    }
  })();

  return refreshPromise;
}

app.get("/api/status/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const currentData = readData();
  const checksToSend =
    isRefreshing && activeChecks
      ? activeChecks
      : currentData.cached_checks || [];
  const countToSend = isRefreshing
    ? activeOutagesCount
    : currentData.cached_outagesCount || 0;

  send("init", {
    checks: checksToSend,
    outages: currentData.outages || [],
    outagesCount: countToSend,
    last_update: currentData.last_update,
    timezone: currentData.timezone || DEFAULT_TIMEZONE,
    is_refreshing: isRefreshing,
  });

  const onCheckUpdated = (data) => send("check_updated", data);
  const onDone = (data) => send("done", data);
  const onStarted = (data) => send("refresh_started", data);

  statusEmitter.on("check_updated", onCheckUpdated);
  statusEmitter.on("done", onDone);
  statusEmitter.on("refresh_started", onStarted);

  req.on("close", () => {
    statusEmitter.off("check_updated", onCheckUpdated);
    statusEmitter.off("done", onDone);
    statusEmitter.off("refresh_started", onStarted);
  });
});

app.get("/api/status", async (req, res) => {
  const data = readData();
  const now = Date.now();

  const isCacheExpired =
    !data.last_update || now - data.last_update >= CACHE_TIME;

  const hasCachedChecks =
    Array.isArray(data.cached_checks) &&
    (data.cached_checks.length > 0 || (data.checks || []).length === 0);

  if (isCacheExpired && !isRefreshing) {
    triggerBackgroundRefresh();
  }

  const checksToSend =
    isRefreshing && activeChecks ? activeChecks : data.cached_checks || [];
  const countToSend = isRefreshing
    ? activeOutagesCount
    : data.cached_outagesCount || 0;

  if (hasCachedChecks && !isRefreshing) {
    return res.json({
      cached: true,
      is_refreshing: false,
      checks: checksToSend,
      outages: data.outages || [],
      outagesCount: countToSend,
      last_update: data.last_update,
      timezone: data.timezone || DEFAULT_TIMEZONE,
    });
  }

  return res.json({
    cached: false,
    is_refreshing: isRefreshing,
    checks: checksToSend,
    outages: data.outages || [],
    outagesCount: countToSend,
    last_update: isRefreshing ? 0 : data.last_update,
    timezone: data.timezone || DEFAULT_TIMEZONE,
  });
});

app.get("/api/data", ensureAuth, (req, res) => {
  cancelCurrentRefresh();
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

  cancelCurrentRefresh();

  newData.password = currentData.password;
  newData.timezone =
    newData.timezone || currentData.timezone || DEFAULT_TIMEZONE;

  newData.cached_checks = [];
  newData.cached_outagesCount = 0;
  newData.last_update = 0;

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
