function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang][key]) {
      el.textContent = translations[currentLang][key];
    }
  });
}

function setServicesHeadingVisible(isVisible) {
  const heading = document.getElementById("services-heading");
  if (!heading) return;
  heading.classList.toggle("d-none", !isVisible);
}

let lastRenderedLastUpdate = null;

function renderLastUpdateLink(lastUpdate = null) {
  if (lastUpdate !== null) {
    lastRenderedLastUpdate = lastUpdate;
  }
  const link = document.getElementById("last-update");
  if (!link) return;

  const value = lastUpdate !== null ? lastUpdate : lastRenderedLastUpdate;
  if (!value) {
    link.textContent = `${t("last_update")} ${t("loading_short")}`;
    return;
  }

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) {
    link.textContent = `${t("last_update")} ${t("loading_short")}`;
    return;
  }

  link.textContent = `${t("last_update")} ${formatDateTimeWithSeconds(date, browserTimeZone)}`;
}

function initializeLoadingState() {
  setServicesHeadingVisible(false);
  renderLastUpdateLink();
  updateFavicon("loading");
}

let statusEventSource = null;
let lastRenderedChecks = [];

function setBadgesLoading() {
  updateFavicon("loading");
  document.querySelectorAll("#services-list .badge").forEach((badge) => {
    badge.className = "badge bg-secondary";
    badge.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" style="width: 0.75rem; height: 0.75rem;"></span>${t("loading_short")}`;
  });
}

function applyCheckBadge(badge, check) {
  badge.className = "badge";
  if (check.is_checking || check.status === "checking") {
    badge.classList.add("bg-secondary");
    badge.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" style="width: 0.75rem; height: 0.75rem;"></span>${t("loading_short")}`;
  } else if (check.status === "success") {
    badge.classList.add("bg-success");
    badge.textContent = t("is_up");
  } else {
    badge.classList.add("bg-danger");
    badge.textContent = t("is_down");
  }
}

function updateSingleServiceCheck(check, outagesCount) {
  const li = document.querySelector(
    `[data-service-key="${check.group}:${check.name}"]`,
  );
  if (li) {
    if (check.type) {
      li.setAttribute("data-check-type", check.type);
    }
    const badge = li.querySelector(".badge");
    if (badge) {
      applyCheckBadge(badge, check);
    }
  }
}

function setRefreshButtonDisabled(disabled) {
  const btn = document.getElementById("btn-refresh");
  if (btn) {
    btn.disabled = disabled;
  }
}

function connectStatusStream() {
  if (statusEventSource) {
    statusEventSource.close();
    statusEventSource = null;
  }

  if (typeof EventSource === "undefined") {
    return;
  }

  statusEventSource = new EventSource("/api/status/stream");

  statusEventSource.addEventListener("init", (e) => {
    const data = JSON.parse(e.data);
    if (data.is_refreshing) {
      updateFavicon("loading");
      lastRenderedChecks = data.checks || [];
      renderServices(data.checks);
      setServicesHeadingVisible(true);
      renderLastUpdateLink(data.last_update);
      renderOutages(data.outages || [], data.timezone || browserTimeZone);
      setRefreshButtonDisabled(true);
    } else {
      updateFavicon(data.outagesCount > 0);
    }
  });

  statusEventSource.addEventListener("refresh_started", () => {
    setRefreshButtonDisabled(true);
    renderLastUpdateLink(0);
    updateFavicon("loading");
  });

  statusEventSource.addEventListener("check_updated", (e) => {
    const data = JSON.parse(e.data);
    updateSingleServiceCheck(data.check, data.outagesCount);
  });

  statusEventSource.addEventListener("done", (e) => {
    const data = JSON.parse(e.data);
    renderLastUpdateLink(data.last_update);
    if (Array.isArray(data.checks)) {
      lastRenderedChecks = data.checks;
      renderServices(data.checks);
    }
    setRefreshButtonDisabled(false);
    updateFavicon(data.outagesCount > 0);
  });

  statusEventSource.onerror = () => {
    statusEventSource.close();
    statusEventSource = null;
  };
}

async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    if (!res.ok) {
      if (lastRenderedChecks.length > 0) {
        renderServices(lastRenderedChecks);
      }
      return;
    }

    const data = await res.json();

    if (data.cached) {
      updateFavicon("loading");
      const loadingChecks = (data.checks || []).map((c) => ({
        ...c,
        is_checking: true,
        status: "checking",
      }));
      renderServices(loadingChecks);
      setServicesHeadingVisible(true);
      renderLastUpdateLink(data.last_update);
      renderOutages(data.outages || [], data.timezone || browserTimeZone);
      setRefreshButtonDisabled(false);

      await new Promise((resolve) => setTimeout(resolve, 500));

      lastRenderedChecks = data.checks || [];
      renderServices(data.checks);
      updateFavicon(data.outagesCount > 0);
    } else {
      lastRenderedChecks = data.checks || [];
      renderServices(data.checks);
      setServicesHeadingVisible(true);
      renderLastUpdateLink(data.last_update);
      renderOutages(data.outages || [], data.timezone || browserTimeZone);
      setRefreshButtonDisabled(!!data.is_refreshing);
      if (data.is_refreshing) {
        updateFavicon("loading");
      } else {
        updateFavicon(data.outagesCount > 0);
      }
    }
  } catch {
    if (lastRenderedChecks.length > 0) {
      renderServices(lastRenderedChecks);
    }
  }
}

function renderServices(checks) {
  const list = document.getElementById("services-list");
  const groupTpl = document.getElementById("tpl-group-header");
  const itemTpl = document.getElementById("tpl-service-item");
  list.innerHTML = "";

  const grouped = {};
  (checks || []).forEach((check) => {
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
      const li = item.querySelector("li");
      const nameSpan = item.querySelector(".service-name");
      const badge = item.querySelector(".badge");

      li.setAttribute("data-service-key", `${check.group}:${check.name}`);
      if (check.type) {
        li.setAttribute("data-check-type", check.type);
      }

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

      applyCheckBadge(badge, check);

      list.appendChild(item);
    });
  });
}

function updateFavicon(status) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";

  let key = status;
  if (typeof status === "boolean" || typeof status === "number") {
    key = status ? "down" : "up";
  }

  link.href = `data:image/svg+xml,${encodeURIComponent(getFaviconSvg(key))}`;
}
