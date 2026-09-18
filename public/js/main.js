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
    if (lastRenderedChecks.length > 0) {
      renderServices(lastRenderedChecks);
    }
    if (lastOutagesData.length > 0) {
      renderOutages(lastOutagesData, lastSourceTimeZone);
    }
  });

  connectStatusStream();
  loadStatus();

  const refreshBtn = document.getElementById("btn-refresh");
  refreshBtn.addEventListener("click", () => {
    setBadgesLoading();
    loadStatus();
  });
});
