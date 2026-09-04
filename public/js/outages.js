const RELATIVE_OUTAGE_REFRESH_INTERVAL_MS = 1000;

let outageRelativeRefreshId = null;

function ensureOutageRelativeRefresh() {
  if (outageRelativeRefreshId !== null) {
    return;
  }

  outageRelativeRefreshId = window.setInterval(() => {
    if (document.hidden || !showRelativeTime) {
      return;
    }

    refreshOutageRelativeTimes();
  }, RELATIVE_OUTAGE_REFRESH_INTERVAL_MS);
}

function refreshOutageRelativeTimes() {
  document
    .querySelectorAll("[data-relative-outage-time]")
    .forEach((element) => {
      const isoDate = element.dataset.relativeOutageTime;
      const fullValue = element.dataset.fullValue || "-";

      if (!isoDate) {
        element.textContent = fullValue;
        element.title = fullValue;
        return;
      }

      const date = new Date(isoDate);
      const hasValidDate = !Number.isNaN(date.getTime());

      element.textContent =
        showRelativeTime && hasValidDate ? formatRelativeTime(date) : fullValue;
      element.title = fullValue;
    });

  document.querySelectorAll("[data-end-label-date]").forEach((element) => {
    const isoDate = element.dataset.endLabelDate;
    const date = new Date(isoDate);
    if (!Number.isNaN(date.getTime())) {
      const isEnded = date < new Date();
      element.textContent = isEnded
        ? t("outage_end")
        : t("outage_expected_end");
    }
  });
}

function renderOutages(outages, sourceTimeZone) {
  lastOutagesData = outages;
  lastSourceTimeZone = sourceTimeZone;

  const container = document.getElementById("outages-container");
  if (!outages.length) {
    container.classList.add("d-none");
    return;
  }

  const now = new Date();
  const sorted = [...outages].sort(
    (a, b) =>
      (parseDateTimeInTimeZone(b.date, sourceTimeZone) || new Date(0)) -
      (parseDateTimeInTimeZone(a.date, sourceTimeZone) || new Date(0)),
  );

  const active = [];
  const archived = [];

  sorted.forEach((inc) => {
    const endDate = parseDateTimeInTimeZone(inc.endDate, sourceTimeZone);
    if (endDate && endDate < now) {
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
  ensureOutageRelativeRefresh();

  const activeDiv = document.getElementById("active-outages");
  const activeTable = document.getElementById("outages-table");
  if (active.length) {
    activeDiv.classList.remove("d-none");
    activeTable.innerHTML = "";
    active.forEach((outage) =>
      activeTable.appendChild(createOutageRow(outage, sourceTimeZone)),
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
      archiveTable.appendChild(createOutageRow(outage, sourceTimeZone)),
    );
  } else {
    archiveContainer.classList.add("d-none");
  }
}

function createOutageRow(outage, sourceTimeZone) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 2;
  td.className = "outage-row-col";

  const startDate = parseDateTimeInTimeZone(outage.date, sourceTimeZone);
  const endDate = parseDateTimeInTimeZone(outage.endDate, sourceTimeZone);

  const startFullValue = startDate
    ? formatDateTime(startDate, browserTimeZone)
    : outage.date;
  const endFullValue = endDate ? formatDateTime(endDate, browserTimeZone) : "-";

  const startRelativeValue = startDate
    ? formatRelativeTime(startDate)
    : outage.date;
  const endRelativeValue = endDate ? formatRelativeTime(endDate) : "-";

  const isEnded = Boolean(endDate && endDate < new Date());

  const datesContainer = document.createElement("div");
  datesContainer.className = "outage-dates-grid";

  const startCol = document.createElement("div");
  startCol.className = "outage-date-col outage-date-col-start";
  const startLabel = document.createElement("div");
  startLabel.className = "outage-date-label";
  startLabel.textContent = t("outage_start");
  const startValueEl = document.createElement("div");
  startValueEl.className = "outage-date-value outage-date-value-clickable";
  startValueEl.dataset.fullValue = startFullValue || outage.date;
  if (startDate) {
    startValueEl.dataset.relativeOutageTime = startDate.toISOString();
  }
  startValueEl.textContent = showRelativeTime
    ? startRelativeValue
    : startFullValue;
  startValueEl.style.cursor = "pointer";
  startValueEl.title = startFullValue || "-";
  startValueEl.addEventListener("click", toggleTimeFormat);
  startCol.appendChild(startLabel);
  startCol.appendChild(startValueEl);

  const endCol = document.createElement("div");
  endCol.className = "outage-date-col outage-date-col-end";
  const endLabel = document.createElement("div");
  endLabel.className = "outage-date-label";
  if (endDate) {
    endLabel.dataset.endLabelDate = endDate.toISOString();
  }
  endLabel.textContent = isEnded ? t("outage_end") : t("outage_expected_end");
  const endValueEl = document.createElement("div");
  endValueEl.className = "outage-date-value outage-date-value-clickable";
  endValueEl.dataset.fullValue = endFullValue || "-";
  if (endDate) {
    endValueEl.dataset.relativeOutageTime = endDate.toISOString();
  }
  endValueEl.textContent = showRelativeTime ? endRelativeValue : endFullValue;
  endValueEl.style.cursor = "pointer";
  endValueEl.title = endFullValue || "-";
  endValueEl.addEventListener("click", toggleTimeFormat);
  endCol.appendChild(endLabel);
  endCol.appendChild(endValueEl);

  datesContainer.appendChild(startCol);
  datesContainer.appendChild(endCol);

  const descLine = document.createElement("div");
  descLine.className = "outage-line-desc";
  descLine.textContent = outage.text;

  td.appendChild(datesContainer);
  td.appendChild(descLine);
  tr.appendChild(td);
  return tr;
}

function toggleTimeFormat(e) {
  e.stopPropagation();
  showRelativeTime = !showRelativeTime;
  refreshOutageRelativeTimes();
}
