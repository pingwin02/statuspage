function getFaviconSvg(status) {
  const colors = {
    loading: ["#ced4da", "#6c757d", "#495057"],
    up: ["#75b798", "#198754", "#0f5132"],
    down: ["#ea868f", "#dc3545", "#842029"],
  };
  const [c1, c2, c3] = colors[status] || colors.up;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><radialGradient id="g" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></radialGradient></defs><circle cx="16" cy="16" r="14" fill="url(#g)"/></svg>`;
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getFaviconSvg,
  };
}
