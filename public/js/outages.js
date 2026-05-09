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

  const datesContainer = document.createElement("div");
  datesContainer.className = "outage-dates-grid";

  const startCol = document.createElement("div");
  startCol.className = "outage-date-col outage-date-col-start";
  const startLabel = document.createElement("div");
  startLabel.className = "outage-date-label";
  startLabel.textContent = t("outage_start");
  const startValueEl = document.createElement("div");
  startValueEl.className = "outage-date-value outage-date-value-clickable";
  startValueEl.textContent = showRelativeTime
    ? startRelativeValue
    : startFullValue;
  startValueEl.style.cursor = "pointer";
  startValueEl.title = startFullValue || '-';
  startValueEl.addEventListener("click", toggleTimeFormat);
  startCol.appendChild(startLabel);
  startCol.appendChild(startValueEl);

  const endCol = document.createElement("div");
  endCol.className = "outage-date-col outage-date-col-end";
  const endLabel = document.createElement("div");
  endLabel.className = "outage-date-label";
  endLabel.textContent = t("outage_expected_end");
  const endValueEl = document.createElement("div");
  endValueEl.className = "outage-date-value outage-date-value-clickable";
  endValueEl.textContent = showRelativeTime ? endRelativeValue : endFullValue;
  endValueEl.style.cursor = "pointer";
  endValueEl.title = endFullValue || '-';
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

  if (lastOutagesData.length) {
    renderOutages(lastOutagesData, lastSourceTimeZone);
  }
}
