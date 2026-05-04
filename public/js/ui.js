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
  document.getElementById("last-update").textContent =
    `${t("last_update")} ${formatDateTimeWithSeconds(d, browserTimeZone)}`;

  renderOutages(data.outages || [], data.timezone || browserTimeZone);
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
