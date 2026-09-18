document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  checkAuth();

  document.getElementById("btn-login").addEventListener("click", doLogin);
  document.getElementById("btn-setup").addEventListener("click", doSetup);

  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const setupContainer = document.getElementById("setup-btn-container");
      if (!setupContainer.classList.contains("d-none")) {
        doSetup();
      } else {
        doLogin();
      }
    }
  });

  document.getElementById("btn-logout").addEventListener("click", async () => {
    await apiFetch("/api/logout", { method: "POST" });
    checkAuth();
  });

  document.getElementById("btn-add-group").addEventListener("click", () => {
    const checksList = document.getElementById("edit-checks-list");
    const newGroup = createGroupCard("");
    checksList.appendChild(newGroup);
    newGroup.querySelector(".group-name-input")?.focus();
    newGroup.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  document.getElementById("btn-save-all").addEventListener("click", saveAll);

  document.getElementById("btn-add-outage").addEventListener("click", () => {
    const container = document.getElementById("edit-outages-list");
    container.appendChild(
      createOutageEditRow({
        date: getCurrentDateTimeLocalValue(),
        endDate: "",
        text: "",
      }),
    );
  });

  document
    .getElementById("btn-change-password")
    .addEventListener("click", changePassword);

  document
    .getElementById("btn-detect-timezone")
    ?.addEventListener("click", () => {
      const browserTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw";
      const select = document.getElementById("config-timezone");
      if (select) {
        select.value = browserTz;
      }
    });
});

async function doLogin() {
  const password = document.getElementById("login-password").value;
  if (!password) {
    showToast("Password cannot be empty", "danger");
    return;
  }
  const res = await apiFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok && (await res.json()).success) {
    checkAuth();
  } else {
    showToast("Invalid password", "danger");
  }
}

async function doSetup() {
  const password = document.getElementById("login-password").value;
  if (!password) {
    showToast("Password cannot be empty", "danger");
    return;
  }
  const res = await apiFetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok && (await res.json()).success) {
    showToast("Password set!", "success");
    setTimeout(checkAuth, 1000);
  } else {
    showToast("Error setting password", "danger");
  }
}

async function checkAuth() {
  const res = await apiFetch("/api/checkAuth");
  const { loggedIn, needsSetup } = await res.json();

  const loginSection = document.getElementById("login-section");
  const adminPanel = document.getElementById("admin-panel");
  const navbar = document.getElementById("navbar");
  const loginTitle = document.getElementById("login-title");
  const loginBtnContainer = document.getElementById("login-btn-container");
  const setupBtnContainer = document.getElementById("setup-btn-container");

  if (needsSetup) {
    loginSection.classList.remove("d-none");
    adminPanel.classList.add("d-none");
    navbar.classList.add("d-none");
    loginTitle.textContent = "Create Password";
    loginBtnContainer.classList.add("d-none");
    setupBtnContainer.classList.remove("d-none");
    return;
  }

  if (loggedIn) {
    loginSection.classList.add("d-none");
    adminPanel.classList.remove("d-none");
    navbar.classList.remove("d-none");
    loadAdminData();
  } else {
    loginSection.classList.remove("d-none");
    adminPanel.classList.add("d-none");
    navbar.classList.add("d-none");
    loginTitle.textContent = "Login";
    loginBtnContainer.classList.remove("d-none");
    setupBtnContainer.classList.add("d-none");
  }
}

async function loadAdminData() {
  const res = await apiFetch("/api/data");
  if (!res.ok) return;
  const config = await res.json();

  const checksList = document.getElementById("edit-checks-list");
  checksList.innerHTML = "";

  const grouped = new Map();
  (config.checks || []).forEach((check) => {
    const gName = check.group ? check.group.trim() : "";
    if (!grouped.has(gName)) {
      grouped.set(gName, []);
    }
    grouped.get(gName).push(check);
  });

  for (const [groupName, groupChecks] of grouped.entries()) {
    const groupEl = createGroupCard(groupName);
    const container = groupEl.querySelector(".checks-container");
    groupChecks.forEach((check) => {
      container.appendChild(createCheckEditRow(check));
    });
    checksList.appendChild(groupEl);
  }

  if (grouped.size === 0) {
    checksList.appendChild(createGroupCard(""));
  }

  new Sortable(checksList, {
    handle: ".group-drag-handle",
    animation: 150,
  });

  const outagesList = document.getElementById("edit-outages-list");
  outagesList.innerHTML = "";
  const sortedOutages = [...(config.outages || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  sortedOutages.forEach((outage) => {
    outagesList.appendChild(createOutageEditRow(outage));
  });

  populateTimezoneSelect(config.timezone);
}

async function saveAll() {
  const timezoneSelect = document.getElementById("config-timezone");
  const selectedTimezone =
    timezoneSelect?.value?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "Europe/Warsaw";
  const groupCards = document.querySelectorAll(".group-card");
  const checks = [];

  groupCards.forEach((groupCard) => {
    const groupName =
      groupCard.querySelector(".group-name-input")?.value.trim() || "";
    const checkRows = groupCard.querySelectorAll(".check-edit-row");
    checkRows.forEach((row) => {
      const type = row.querySelector(".check-type").value;
      const chk = {
        group: groupName,
        type,
        name: row.querySelector(".check-name").value.trim(),
        host: row.querySelector(".check-host").value.trim(),
      };
      if (type === "manual") {
        chk.manual_status = row.querySelector(".check-manual")?.value || "up";
      }
      checks.push(chk);
    });
  });

  const outageRows = document.querySelectorAll(".outage-edit-row");
  const outages = Array.from(outageRows).map((row) => ({
    date: normalizeDateTimeLocalValue(row.querySelector(".outage-date").value),
    endDate: normalizeDateTimeLocalValue(
      row.querySelector(".outage-end").value,
    ),
    text: row.querySelector(".outage-text").value,
  }));

  const invalidOutageIndex = outages.findIndex((outage) => {
    if (!outage.date || !outage.endDate) return false;
    return new Date(outage.endDate) <= new Date(outage.date);
  });

  if (invalidOutageIndex !== -1) {
    showToast(
      `Outage #${invalidOutageIndex + 1}: End date must be later than start date`,
      "danger",
    );
    return;
  }

  const res = await apiFetch("/api/data");
  const existing = await res.json();
  const updated = {
    ...existing,
    checks,
    outages,
    timezone: selectedTimezone,
  };

  const saveRes = await apiFetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  });

  if (saveRes.ok) {
    window.location.href = "/";
  } else {
    showToast("An error occurred", "danger");
  }
}

async function changePassword() {
  const newPassword = document.getElementById("new-password").value;
  if (!newPassword) {
    showToast("Password cannot be empty!", "warning");
    return;
  }
  const res = await apiFetch("/api/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  });
  if (res.ok && (await res.json()).success) {
    showToast("Password changed successfully!", "success");
    document.getElementById("new-password").value = "";
  } else {
    showToast("Error changing password", "danger");
  }
}

function createGroupCard(groupName = "") {
  const tpl = document.getElementById("tpl-group-card");
  const clone = tpl.content.cloneNode(true);
  const card = clone.querySelector(".group-card");
  const nameInput = card.querySelector(".group-name-input");
  nameInput.value = groupName;

  card.querySelector(".btn-remove-group").addEventListener("click", () => {
    card.remove();
  });

  const checksContainer = card.querySelector(".checks-container");
  new Sortable(checksContainer, {
    group: "checks",
    handle: ".drag-handle",
    animation: 150,
  });

  card.querySelector(".btn-add-check-group").addEventListener("click", () => {
    const newCheck = createCheckEditRow();
    checksContainer.appendChild(newCheck);
    newCheck.querySelector(".check-name")?.focus();
  });

  return card;
}

function createCheckEditRow(check = {}) {
  const tpl = document.getElementById("tpl-check-row");
  const clone = tpl.content.cloneNode(true);
  const div = clone.querySelector(".check-edit-row");

  const typeSelect = div.querySelector(".check-type");
  const nameInput = div.querySelector(".check-name");
  const hostInput = div.querySelector(".check-host");
  const manualCol = div.querySelector(".check-manual-col");
  const hostCol = div.querySelector(".check-host-col");
  const manualSelect = div.querySelector(".check-manual");

  typeSelect.value = check.type || "http";
  nameInput.value = check.name || "";
  hostInput.value = check.host || "";

  if (check.type === "manual") {
    manualCol.classList.remove("d-none");
    hostCol.classList.add("d-none");
    manualSelect.value = check.manual_status || "up";
  }

  typeSelect.addEventListener("change", () => {
    if (typeSelect.value === "manual") {
      manualCol.classList.remove("d-none");
      hostCol.classList.add("d-none");
    } else {
      manualCol.classList.add("d-none");
      hostCol.classList.remove("d-none");
    }
  });

  div.querySelector(".btn-remove-row").addEventListener("click", () => {
    div.remove();
  });

  return div;
}

function createOutageEditRow(outage) {
  const tpl = document.getElementById("tpl-outage-row");
  const clone = tpl.content.cloneNode(true);
  const div = clone.querySelector(".outage-edit-row");

  div.querySelector(".outage-date").value = normalizeDateTimeLocalValue(
    outage.date,
  );
  div.querySelector(".outage-end").value = normalizeDateTimeLocalValue(
    outage.endDate,
  );

  const textarea = div.querySelector(".outage-text");
  textarea.value = outage.text || "";
  textarea.addEventListener("input", () => autoResize(textarea));
  setTimeout(() => autoResize(textarea), 0);

  div.querySelector(".btn-remove-row").addEventListener("click", () => {
    div.remove();
  });

  return div;
}

function getCurrentDateTimeLocalValue() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 19);
}

function normalizeDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }

  const normalizedValue = String(value).trim().replace(" ", "T");
  const dateTimeMatch = normalizedValue.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?/,
  );

  if (dateTimeMatch) {
    return `${dateTimeMatch[1]}:${dateTimeMatch[2] || "00"}`;
  }

  const parsedDate = new Date(normalizedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const tzOffset = parsedDate.getTimezoneOffset() * 60000;
  return new Date(parsedDate.getTime() - tzOffset).toISOString().slice(0, 19);
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

async function apiFetch(input, init) {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Unauthorized");
  }
  return res;
}

function populateTimezoneSelect(selectedTimezone) {
  const select = document.getElementById("config-timezone");
  if (!select) return;
  select.innerHTML = "";

  let timezones = [];
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      timezones = Intl.supportedValuesOf("timeZone");
    } catch {
      timezones = [];
    }
  }

  if (!Array.isArray(timezones) || timezones.length === 0) {
    timezones = [
      "Africa/Cairo",
      "America/Anchorage",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/New_York",
      "America/Sao_Paulo",
      "America/Toronto",
      "Asia/Bangkok",
      "Asia/Dubai",
      "Asia/Hong_Kong",
      "Asia/Jerusalem",
      "Asia/Kolkata",
      "Asia/Seoul",
      "Asia/Shanghai",
      "Asia/Singapore",
      "Asia/Tokyo",
      "Australia/Sydney",
      "Europe/Amsterdam",
      "Europe/Berlin",
      "Europe/London",
      "Europe/Madrid",
      "Europe/Paris",
      "Europe/Rome",
      "Europe/Warsaw",
      "Pacific/Auckland",
      "Pacific/Honolulu",
      "UTC",
    ];
  }

  const browserTz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw";
  const currentTz = selectedTimezone || browserTz;

  const tzSet = new Set(timezones);
  tzSet.add(browserTz);
  if (selectedTimezone) {
    tzSet.add(selectedTimezone);
  }

  const sortedTimezones = Array.from(tzSet).sort((a, b) => a.localeCompare(b));

  sortedTimezones.forEach((tz) => {
    const opt = document.createElement("option");
    opt.value = tz;
    opt.textContent = tz;
    if (tz === currentTz) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}
