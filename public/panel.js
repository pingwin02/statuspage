document.addEventListener("DOMContentLoaded", () => {
  M.AutoInit();
  checkAuth();

  document.getElementById("btn-login").addEventListener("click", async () => {
    const password = document.getElementById("login-password").value;
    if (!password) {
      M.toast({ html: "Password cannot be empty", classes: "red" });
      return;
    }
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok && (await res.json()).success) {
      checkAuth();
    } else {
      M.toast({ html: "Invalid password", classes: "red" });
    }
  });

  const btnSetup = document.getElementById("btn-setup");
  if (btnSetup) {
    btnSetup.addEventListener("click", async () => {
      const password = document.getElementById("login-password").value;
      if (!password) {
        M.toast({ html: "Password cannot be empty", classes: "red" });
        return;
      }
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok && (await res.json()).success) {
        M.toast({ html: "Password set!", classes: "green" });
        setTimeout(checkAuth, 1000);
      } else {
        M.toast({ html: "Error setting password", classes: "red" });
      }
    });
  }

  document.getElementById("login-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const btnLogin = document.getElementById("btn-login");
      const btnSetup = document.getElementById("btn-setup");

      if (btnSetup && !btnSetup.parentElement.classList.contains("hidden")) {
        btnSetup.click();
      } else if (btnLogin) {
        btnLogin.click();
      }
    }
  });

  document.getElementById("btn-logout").addEventListener("click", async (e) => {
    e.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    checkAuth();
  });

  document.getElementById("btn-add-check").addEventListener("click", () => {
    const container = document.getElementById("edit-checks-list");
    container.appendChild(
      createCheckEditRow({
        group: "",
        type: "http",
        name: "",
        host: "",
      }),
    );
    M.AutoInit();
  });

  document
    .getElementById("btn-save-all")
    .addEventListener("click", async () => {
      const checkRows = document.querySelectorAll(".check-edit-row");
      const checks = Array.from(checkRows).map((row) => {
        const type = row.querySelector(".check-type").value;
        const chk = {
          group: row.querySelector(".check-group").value,
          type: type,
          name: row.querySelector(".check-name").value,
          host: row.querySelector(".check-host").value,
        };
        if (type === "manual") {
          chk.manual_status = row.querySelector(".check-manual")
            ? row.querySelector(".check-manual").value
            : "up";
        }
        return chk;
      });

      const incRows = document.querySelectorAll(".incident-edit-row");
      const incidents = Array.from(incRows).map((row) => ({
        date: row.querySelector(".incident-date").value,
        endDate: row.querySelector(".incident-end").value,
        text: row.querySelector(".incident-text").value,
      }));

      await updateData({ checks, incidents });
    });

  document.getElementById("btn-add-incident").addEventListener("click", () => {
    const container = document.getElementById("edit-incidents-list");
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const strDate = new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
    container.appendChild(
      createIncidentEditRow({ date: strDate, endDate: "", text: "" }),
    );
  });

  document
    .getElementById("btn-change-password")
    .addEventListener("click", async () => {
      const newPassword = document.getElementById("new-password").value;
      if (!newPassword) {
        M.toast({ html: "Password cannot be empty!", classes: "orange" });
        return;
      }
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok && (await res.json()).success) {
        M.toast({ html: "Password changed successfully!", classes: "green" });
        document.getElementById("new-password").value = "";
      } else {
        M.toast({ html: "Error changing password", classes: "red" });
      }
    });
});

let currentConfig = null;

async function checkAuth() {
  const res = await fetch("/api/checkAuth");
  const { loggedIn, needsSetup } = await res.json();

  if (needsSetup) {
    document.getElementById("login-section").classList.remove("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("navbar").classList.add("hidden");

    document.getElementById("login-title").innerText = "Create Password";
    document.getElementById("login-label").innerText =
      "Type your new admin password";
    document.getElementById("login-btn-container").classList.add("hidden");
    document.getElementById("setup-btn-container").classList.remove("hidden");
    return;
  }

  if (loggedIn) {
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    document.getElementById("navbar").classList.remove("hidden");
    loadAdminData();
  } else {
    document.getElementById("login-section").classList.remove("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("navbar").classList.add("hidden");

    document.getElementById("login-title").innerText = "Login";
    document.getElementById("login-label").innerText = "Admin password";
    document.getElementById("login-btn-container").classList.remove("hidden");
    document.getElementById("setup-btn-container").classList.add("hidden");
  }
}

async function loadAdminData() {
  const res = await fetch("/api/data");
  if (!res.ok) return;
  currentConfig = await res.json();

  const checksList = document.getElementById("edit-checks-list");
  checksList.innerHTML = "";
  (currentConfig.checks || []).forEach((check) => {
    checksList.appendChild(createCheckEditRow(check));
  });
  new Sortable(checksList, { handle: ".drag-handle", animation: 150 });

  const incidentsList = document.getElementById("edit-incidents-list");
  incidentsList.innerHTML = "";

  const sortedIncidents = [...(currentConfig.incidents || [])];
  sortedIncidents.sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedIncidents.forEach((inc) => {
    incidentsList.appendChild(createIncidentEditRow(inc));
  });

  M.AutoInit();
}

async function updateData(partialData) {
  const res = await fetch("/api/data");
  const existing = await res.json();
  const updated = { ...existing, ...partialData };

  const saveRes = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  });
  if (saveRes.ok) {
    M.toast({ html: "Saved successfully!", classes: "green" });
    loadAdminData();
  } else {
    M.toast({ html: "An error occurred", classes: "red" });
  }
}

function toggleManual(selectElem) {
  const row = selectElem.closest(".check-item");
  const manualCol = row.querySelector(".check-manual-col");
  const hostCol = row.querySelector(".check-host-col");
  if (selectElem.value === "manual") {
    manualCol.style.display = "block";
    hostCol.style.display = "none";
  } else {
    manualCol.style.display = "none";
    hostCol.style.display = "block";
  }
}

function createCheckEditRow(check) {
  const div = document.createElement("div");
  div.className = "row check-item check-edit-row";

  const idSuffix = Math.random().toString(36).substring(2, 9);

  div.innerHTML = `
      <div class="col s12 m1 center-align">
          <i class="material-icons drag-handle">drag_handle</i>
      </div>
      <div class="col s12 m2 input-field">
          <input type="text" id="grp-${idSuffix}" class="check-group" value="${check.group || ""}">
          <label for="grp-${idSuffix}" class="${check.group ? "active" : ""}">Group</label>
      </div>
      <div class="col s12 m2 input-field">
          <select class="check-type browser-default" style="display:block;" onchange="toggleManual(this)">
              <option value="http" ${check.type === "http" ? "selected" : ""}>HTTP</option>
              <option value="ping" ${check.type === "ping" ? "selected" : ""}>PING</option>
              <option value="port" ${check.type === "port" ? "selected" : ""}>PORT</option>
              <option value="manual" ${check.type === "manual" ? "selected" : ""}>Manual</option>
          </select>
          <label class="active">Type</label>
      </div>
      <div class="col s12 m2 input-field check-manual-col" style="${check.type !== "manual" ? "display:none;" : ""}">
          <select class="check-manual browser-default" style="display:block;">
              <option value="up" ${check.manual_status === "up" ? "selected" : ""}>Operational (UP)</option>
              <option value="down" ${check.manual_status === "down" ? "selected" : ""}>Outage (DOWN)</option>
          </select>
          <label class="active">Set status</label>
      </div>
      <div class="col s12 m2 input-field">
          <input type="text" id="name-${idSuffix}" class="check-name" value="${check.name || ""}">
          <label for="name-${idSuffix}" class="${check.name ? "active" : ""}">Name</label>
      </div>
      <div class="col s12 m4 input-field check-host-col" style="${check.type === "manual" ? "display:none;" : ""}">
          <input type="text" id="host-${idSuffix}" class="check-host" value="${check.host || ""}">
          <label for="host-${idSuffix}" class="${check.host ? "active" : ""}">Host/URL</label>
      </div>
      <div class="col s12 m1 actions" style="margin-top: 15px;">
          <button class="btn-floating waves-effect waves-light red" onclick="this.closest('.check-item').remove()"><i class="material-icons">delete</i></button>
      </div>
  `;
  return div;
}

function createIncidentEditRow(inc) {
  const div = document.createElement("div");
  div.className = "row incident-item incident-edit-row";
  div.innerHTML = `
      <div class="col s12 m3 input-field">
          <input type="datetime-local" class="incident-date" value="${inc.date || ""}">
          <label class="active">Start date</label>
      </div>
      <div class="col s12 m3 input-field">
          <input type="datetime-local" class="incident-end" value="${inc.endDate || ""}">
          <label class="active">End date (Opt.)</label>
      </div>
      <div class="col s12 m5 input-field">
          <input type="text" class="incident-text" value="${inc.text || ""}" placeholder="Description">
          <label class="active">Outage / Incident description</label>
      </div>
      <div class="col s12 m1 actions" style="margin-top: 15px;">
          <button class="btn-floating waves-effect waves-light red" onclick="this.closest('.incident-item').remove()"><i class="material-icons">delete</i></button>
      </div>
  `;
  return div;
}
