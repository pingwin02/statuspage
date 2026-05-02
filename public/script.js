const translations = {
  pl: {
    system_status: "Status systemu",
    refresh: "Odśwież",
    loading: "Ładowanie statusów...",
    checking: "Sprawdzanie statusów...",
    services: "Usługi",
    incidents: "Incydenty",
    archive: "Archiwum",
    all_good: "Wszystkie systemy działają poprawnie",
    outages: "Liczba awarii:",
    is_up: "Działa",
    is_down: "Nie działa",
    last_update: "Ostatnia aktualizacja:",
    end_date: "Przewidywany koniec",
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
    incidents: "Incidents",
    archive: "Archive",
    all_good: "All systems are operational",
    outages: "Number of outages:",
    is_up: "Operational",
    is_down: "Down",
    last_update: "Last update:",
    end_date: "Estimated end",
    others: "Other",
    rate_limit_error:
      "Refreshing too fast. Please wait before refreshing again.",
  },
};

let currentLang = "pl";

document.addEventListener("DOMContentLoaded", () => {
  const browserLang = navigator.language || navigator.userLanguage;
  currentLang = browserLang.startsWith("pl") ? "pl" : "en";
  applyTranslations();

  const langBtn = document.getElementById("btn-lang");
  if (langBtn) {
    langBtn.textContent = currentLang === "pl" ? "EN" : "PL";
    langBtn.addEventListener("click", () => {
      currentLang = currentLang === "pl" ? "en" : "pl";
      langBtn.textContent = currentLang === "pl" ? "EN" : "PL";
      applyTranslations();
      loadStatus(false);
    });
  }

  loadStatus(false);

  const btnRefresh = document.getElementById("btn-refresh");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      overallStatusLoading();
      loadStatus(true);
    });
  }
});

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang][key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = translations[currentLang][key];
      } else {
        el.textContent = translations[currentLang][key];
      }
    }
  });
}

function overallStatusLoading() {
  document.getElementById("overall-status").innerHTML =
    `<ul><li class='panel'>${translations[currentLang].checking}</li></ul>`;
}

function showToast(message, colorClass = "red") {
  let tc = document.getElementById("custom-toast-container");
  if (!tc) {
    tc = document.createElement("div");
    tc.id = "custom-toast-container";
    document.body.appendChild(tc);
  }
  const t = document.createElement("div");
  t.className = `custom-toast ${colorClass}`;
  t.textContent = message;

  tc.appendChild(t);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      t.classList.add("show");
    });
  });

  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

async function loadStatus(force = false) {
  const res = await fetch(`/api/status${force ? "?force=true" : ""}`);

  if (res.status === 429) {
    showToast(translations[currentLang].rate_limit_error, "red");
    return loadStatus(false);
  }

  const data = await res.json();

  updateFavicon(data.outagesCount > 0);

  const overall = document.getElementById("overall-status");
  if (data.outagesCount === 0) {
    overall.innerHTML = `<ul><li class='panel success-bg'>${translations[currentLang].all_good}</li></ul>`;
  } else {
    overall.innerHTML = `<ul><li class='panel failed-bg'>${translations[currentLang].outages} ${data.outagesCount}</li></ul>`;
  }

  const list = document.getElementById("services-list");
  list.innerHTML = "";

  const grouped = {};
  data.checks.forEach((check) => {
    const gName = check.group || translations[currentLang].others;
    if (!grouped[gName]) grouped[gName] = [];
    grouped[gName].push(check);
  });

  Object.keys(grouped).forEach((gName) => {
    const grpHeader = document.createElement("li");
    grpHeader.className = "panel group";
    grpHeader.textContent = gName;
    list.appendChild(grpHeader);

    grouped[gName].forEach((check) => {
      const li = document.createElement("li");

      let serviceNameHtml = check.name;
      if (check.url) {
        serviceNameHtml = `<a href="${check.url}" target="_blank" class="service-link">${check.name}</a>`;
      }

      if (check.status === "success") {
        li.innerHTML = `${serviceNameHtml} <span class='status success'>${translations[currentLang].is_up}</span>`;
      } else {
        li.innerHTML = `${serviceNameHtml} <span class='status failed'>${translations[currentLang].is_down}</span>`;
      }
      list.appendChild(li);
    });
  });

  const d = data.last_update ? new Date(data.last_update) : new Date();
  document.getElementById("last-update").textContent =
    `${translations[currentLang].last_update} ${("0" + d.getDate()).slice(-2)}.${("0" + (d.getMonth() + 1)).slice(-2)}.${d.getFullYear()} ${("0" + d.getHours()).slice(-2)}:${("0" + d.getMinutes()).slice(-2)}:${("0" + d.getSeconds()).slice(-2)}`;

  if (data.incidents && data.incidents.length > 0) {
    const activeIncidents = [];
    const archivedIncidents = [];
    const now = new Date();

    data.incidents.sort((a, b) => new Date(b.date) - new Date(a.date));

    data.incidents.forEach((inc) => {
      if (inc.endDate) {
        const end = new Date(inc.endDate);
        if (end < now) {
          archivedIncidents.push(inc);
        } else {
          activeIncidents.push(inc);
        }
      } else {
        activeIncidents.push(inc);
      }
    });

    if (activeIncidents.length > 0 || archivedIncidents.length > 0) {
      document.getElementById("incidents-container").style.display = "block";
    } else {
      document.getElementById("incidents-container").style.display = "none";
    }

    if (activeIncidents.length > 0) {
      document.getElementById("active-incidents").style.display = "block";
      const table = document.getElementById("incidents-table");
      table.innerHTML = "";
      activeIncidents.forEach((inc) => {
        const tr = document.createElement("tr");
        let dString = inc.date.replace("T", " ");
        if (inc.endDate)
          dString += `<br><span class="small" style="font-weight:normal">${translations[currentLang].end_date}:<br>${inc.endDate.replace("T", " ")}</span>`;
        tr.innerHTML = `<td class='date-col'>${dString}</td><td class='desc-col'>${inc.text}</td>`;
        table.appendChild(tr);
      });
    } else {
      const activeDiv = document.getElementById("active-incidents");
      if (activeDiv) activeDiv.style.display = "none";
    }

    if (archivedIncidents.length > 0) {
      document.getElementById("archive-container").style.display = "block";
      const archiveTable = document.getElementById("archive-table");
      archiveTable.innerHTML = "";
      archivedIncidents.forEach((inc) => {
        const tr = document.createElement("tr");
        let dString = inc.date.replace("T", " ");
        dString += `<br><span class="small" style="font-weight:normal">${translations[currentLang].end_date}:<br>${inc.endDate.replace("T", " ")}</span>`;
        tr.innerHTML = `<td class='date-col'>${dString}</td><td class='desc-col'>${inc.text}</td>`;
        archiveTable.appendChild(tr);
      });
    } else {
      document.getElementById("archive-container").style.display = "none";
    }
  } else {
    document.getElementById("incidents-container").style.display = "none";
  }
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
