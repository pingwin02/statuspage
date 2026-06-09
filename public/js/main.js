document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();

  const savedLang = localStorage.getItem("lang");
  const browserLang = navigator.language || navigator.userLanguage;
  currentLang = savedLang || (browserLang.startsWith("pl") ? "pl" : "en");
  if (!translations[currentLang]) {
    currentLang = "en";
  }
  applyTranslations();
  initializeLoadingState();

  const langBtn = document.getElementById("btn-lang");
  langBtn.textContent = currentLang === "pl" ? "EN" : "PL";
  langBtn.addEventListener("click", () => {
    currentLang = currentLang === "pl" ? "en" : "pl";
    localStorage.setItem("lang", currentLang);
    langBtn.textContent = currentLang === "pl" ? "EN" : "PL";
    applyTranslations();
    renderLastUpdateLink();
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
