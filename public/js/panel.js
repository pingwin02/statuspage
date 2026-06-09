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

  document.getElementById("btn-add-check").addEventListener("click", () => {
    const container = document.getElementById("edit-checks-list");
    container.appendChild(
      createCheckEditRow({ group: "", type: "http", name: "", host: "" }),
    );
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
});

function showToast(message, type = "danger") {
  const container = document.getElementById("toast-container");
  const tpl = document.getElementById("tpl-toast");
  const clone = tpl.content.cloneNode(true);
  const toastEl = clone.querySelector(".toast");
  toastEl.classList.add("text-bg-" + type);
  toastEl.querySelector(".toast-body").textContent = message;
  container.appendChild(clone);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

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
  (config.checks || []).forEach((check) => {
    checksList.appendChild(createCheckEditRow(check));
  });
  new Sortable(checksList, { handle: ".drag-handle", animation: 150 });

  const outagesList = document.getElementById("edit-outages-list");
  outagesList.innerHTML = "";
  const sortedOutages = [...(config.outages || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  sortedOutages.forEach((outage) => {
    outagesList.appendChild(createOutageEditRow(outage));
  });
}

async function saveAll() {
  const browserTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const checkRows = document.querySelectorAll(".check-edit-row");
  const checks = Array.from(checkRows).map((row) => {
    const type = row.querySelector(".check-type").value;
    const chk = {
      group: row.querySelector(".check-group").value,
      type,
      name: row.querySelector(".check-name").value,
      host: row.querySelector(".check-host").value,
    };
    if (type === "manual") {
      chk.manual_status = row.querySelector(".check-manual")?.value || "up";
    }
    return chk;
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
  const updated = { ...existing, checks, outages, timezone: browserTimeZone };

  const saveRes = await apiFetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  });

  if (saveRes.ok) {
    showToast("Saved successfully!", "success");
    loadAdminData();
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

function createCheckEditRow(check) {
  const tpl = document.getElementById("tpl-check-row");
  const clone = tpl.content.cloneNode(true);
  const div = clone.querySelector(".check-edit-row");

  div.querySelector(".check-group").value = check.group || "";
  div.querySelector(".check-type").value = check.type || "http";
  div.querySelector(".check-name").value = check.name || "";
  div.querySelector(".check-host").value = check.host || "";

  const typeSelect = div.querySelector(".check-type");
  const manualCol = div.querySelector(".check-manual-col");
  const hostCol = div.querySelector(".check-host-col");

  if (check.type === "manual") {
    manualCol.classList.remove("d-none");
    hostCol.classList.add("d-none");
    div.querySelector(".check-manual").value = check.manual_status || "up";
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

function initThemeToggle() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    document.documentElement.setAttribute("data-bs-theme", saved);
  }
  const btn = document.getElementById("btn-theme");
  if (!btn) return;
  updateThemeIcon(btn);
  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-bs-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-bs-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon(btn);
  });
}

function updateThemeIcon(btn) {
  const isDark =
    document.documentElement.getAttribute("data-bs-theme") === "dark";
  btn.querySelector("i").className = isDark ? "bi bi-sun" : "bi bi-moon";
}

async function apiFetch(input, init) {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Unauthorized");
  }
  return res;
}
