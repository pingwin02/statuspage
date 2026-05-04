const translations = {
  pl: {
    system_status: "Status systemu",
    refresh: "Odśwież",
    loading: "Ładowanie statusów...",
    checking: "Sprawdzanie statusów...",
    services: "Usługi",
    outages_section: "Awarie",
    archive: "Archiwum",
    all_good: "Wszystkie systemy działają poprawnie",
    outages: "Liczba awarii:",
    is_up: "Działa",
    is_down: "Nie działa",
    last_update: "Ostatnia aktualizacja:",
    outage_start: "Start",
    outage_expected_end: "Przewidywany koniec",
    others: "Inne",
    rate_limit_error:
      "Zbyt częste odświeżanie. Odczekaj przed kolejnym odświeżeniem.",
  },
  en: {
    system_status: "System Status",
    refresh: "Refresh",
    loading: "Loading statuses...",
    checking: "Checking statuses...",
    services: "Services",
    outages_section: "Outages",
    archive: "Archive",
    all_good: "All systems are operational",
    outages: "Number of outages:",
    is_up: "Operational",
    is_down: "Down",
    last_update: "Last update:",
    outage_start: "Start",
    outage_expected_end: "Expected end",
    others: "Other",
    rate_limit_error:
      "Refreshing too fast. Please wait before refreshing again.",
  },
};

let currentLang = "pl";

function t(key) {
  return translations[currentLang][key] || key;
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();

  const browserLang = navigator.language || navigator.userLanguage;
  currentLang = browserLang.startsWith("pl") ? "pl" : "en";
  applyTranslations();

  const langBtn = document.getElementById("btn-lang");
  langBtn.textContent = currentLang === "pl" ? "EN" : "PL";
  langBtn.addEventListener("click", () => {
    currentLang = currentLang === "pl" ? "en" : "pl";
    langBtn.textContent = currentLang === "pl" ? "EN" : "PL";
    applyTranslations();
    loadStatus(false);
  });

  loadStatus(false);

  document.getElementById("btn-refresh").addEventListener("click", () => {
    const overall = document.getElementById("overall-status");
    overall.innerHTML = "";
    const alert = document.createElement("div");
    alert.className = "alert alert-secondary";
    alert.textContent = t("checking");
    overall.appendChild(alert);
    loadStatus(true);
  });
});

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

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang][key]) {
      el.textContent = translations[currentLang][key];
    }
  });
}

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

async function loadStatus(force = false) {
  const res = await fetch(`/api/status${force ? "?force=true" : ""}`);

  if (res.status === 429) {
    showToast(t("rate_limit_error"), "danger");
    return loadStatus(false);
  }

  const data = await res.json();
  updateFavicon(data.outagesCount > 0);

  const overall = document.getElementById("overall-status");
  overall.innerHTML = "";
  const alert = document.createElement("div");
  alert.className =
    data.outagesCount === 0 ? "alert alert-success" : "alert alert-danger";
  alert.textContent =
    data.outagesCount === 0
      ? t("all_good")
      : `${t("outages")} ${data.outagesCount}`;
  overall.appendChild(alert);

  renderServices(data.checks);

  const d = data.last_update ? new Date(data.last_update) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("last-update").textContent =
    `${t("last_update")} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  renderOutages(data.outages || []);
}

function renderServices(checks) {
  const list = document.getElementById("services-list");
  const groupTpl = document.getElementById("tpl-group-header");
  const itemTpl = document.getElementById("tpl-service-item");
  list.innerHTML = "";

  const grouped = {};
  checks.forEach((check) => {
    const gName = check.group || t("others");
    if (!grouped[gName]) grouped[gName] = [];
    grouped[gName].push(check);
  });

  Object.keys(grouped).forEach((gName) => {
    const header = groupTpl.content.cloneNode(true);
    header.querySelector("li").textContent = gName;
    list.appendChild(header);

    grouped[gName].forEach((check) => {
      const item = itemTpl.content.cloneNode(true);
      const nameSpan = item.querySelector(".service-name");
      const badge = item.querySelector(".badge");

      if (check.url) {
        const link = document.createElement("a");
        link.href = check.url;
        link.target = "_blank";
        link.className = "service-link";
        link.textContent = check.name;
        nameSpan.appendChild(link);
      } else {
        nameSpan.textContent = check.name;
      }

      const isUp = check.status === "success";
      badge.classList.add(isUp ? "bg-success" : "bg-danger");
      badge.textContent = isUp ? t("is_up") : t("is_down");

      list.appendChild(item);
    });
  });
}

function renderOutages(outages) {
  const container = document.getElementById("outages-container");
  if (!outages.length) {
    container.classList.add("d-none");
    return;
  }

  const now = new Date();
  const sorted = [...outages].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  const active = [];
  const archived = [];

  sorted.forEach((inc) => {
    if (inc.endDate && new Date(inc.endDate) < now) {
      archived.push(inc);
    } else {
      active.push(inc);
    }
  });

  if (!active.length && !archived.length) {
    container.classList.add("d-none");
    return;
  }

  container.classList.remove("d-none");

  const activeDiv = document.getElementById("active-outages");
  const activeTable = document.getElementById("outages-table");
  if (active.length) {
    activeDiv.classList.remove("d-none");
    activeTable.innerHTML = "";
    active.forEach((outage) =>
      activeTable.appendChild(createOutageRow(outage)),
    );
  } else {
    activeDiv.classList.add("d-none");
  }

  const archiveContainer = document.getElementById("archive-container");
  const archiveTable = document.getElementById("archive-table");
  if (archived.length) {
    archiveContainer.classList.remove("d-none");
    archiveTable.innerHTML = "";
    archived.forEach((outage) =>
      archiveTable.appendChild(createOutageRow(outage)),
    );
  } else {
    archiveContainer.classList.add("d-none");
  }
}

function createOutageRow(outage) {
  const tr = document.createElement("tr");
  const tdDate = document.createElement("td");
  tdDate.className = "date-col text-muted";

  const startDate = outage.date.replace("T", " ");
  const startLine = document.createElement("div");
  startLine.className = "outage-date-line";
  const startLabel = document.createElement("span");
  startLabel.className = "outage-date-label";
  startLabel.textContent = `${t("outage_start")}:`;
  const startValue = document.createElement("span");
  startValue.className = "outage-date-value";
  startValue.textContent = startDate;
  startLine.appendChild(startLabel);
  startLine.appendChild(document.createElement("br"));
  startLine.appendChild(startValue);
  tdDate.appendChild(startLine);

  if (outage.endDate) {
    const endLine = document.createElement("div");
    endLine.className = "outage-date-line";
    const endLabel = document.createElement("span");
    endLabel.className = "outage-date-label";
    endLabel.textContent = `${t("outage_expected_end")}:`;
    const endValue = document.createElement("span");
    endValue.className = "outage-date-value";
    endValue.textContent = outage.endDate.replace("T", " ");
    endLine.appendChild(endLabel);
    endLine.appendChild(document.createElement("br"));
    endLine.appendChild(endValue);
    tdDate.appendChild(endLine);
  }

  const tdDesc = document.createElement("td");
  tdDesc.className = "desc-col";
  tdDesc.textContent = outage.text;

  tr.appendChild(tdDate);
  tr.appendChild(tdDesc);
  return tr;
}

function updateFavicon(hasOutage) {
  const emoji = hasOutage ? "🔴" : "🟢";
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text y="27" font-size="27">${emoji}</text></svg>`;
}
