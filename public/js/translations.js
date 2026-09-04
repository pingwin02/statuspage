const translations = {
  pl: {
    system_status: "Status systemu",
    refresh: "Odśwież",
    loading: "Ładowanie statusów...",
    loading_short: "Ładowanie...",
    checking: "Sprawdzanie statusów...",
    services: "Usługi",
    outages_section: "Awarie",
    archive: "Archiwum",
    all_good: "Wszystkie systemy działają poprawnie",
    outages: "Liczba awarii:",
    is_up: "Działa",
    is_down: "Nie działa",
    last_update: "Ostatnia aktualizacja:",
    outage_start: "Początek awarii",
    outage_expected_end: "Przewidywany koniec",
    outage_end: "Koniec awarii",
    others: "Inne",
    rate_limit_error:
      "Zbyt częste odświeżanie. Odczekaj chwilę przed kolejnym odświeżeniem.",
    relative_time: {
      now: "w tej chwili",
      second: { singular: "sekundę", few: "sekundy", many: "sekund" },
      minute: { singular: "minutę", few: "minuty", many: "minut" },
      hour: { singular: "godzinę", few: "godziny", many: "godzin" },
      day: { singular: "dzień", few: "dni", many: "dni" },
      futurePrefix: "za ",
      pastSuffix: " temu",
    },
  },
  en: {
    system_status: "System Status",
    refresh: "Refresh",
    loading: "Loading statuses...",
    loading_short: "Loading...",
    checking: "Checking statuses...",
    services: "Services",
    outages_section: "Outages",
    archive: "Archive",
    all_good: "All systems are operational",
    outages: "Number of outages:",
    is_up: "Operational",
    is_down: "Down",
    last_update: "Last update:",
    outage_start: "Outage start",
    outage_expected_end: "Expected end",
    outage_end: "Outage end",
    others: "Other",
    rate_limit_error:
      "Refreshing too fast. Please wait a moment before refreshing again.",
    relative_time: {
      now: "right now",
      second: { singular: "second", few: "seconds", many: "seconds" },
      minute: { singular: "minute", few: "minutes", many: "minutes" },
      hour: { singular: "hour", few: "hours", many: "hours" },
      day: { singular: "day", few: "days", many: "days" },
      futurePrefix: "in ",
      pastSuffix: " ago",
    },
  },
};

let currentLang = "pl";
const browserTimeZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
let showRelativeTime = true;
let lastOutagesData = [];
let lastSourceTimeZone = "";

function t(key) {
  return translations[currentLang][key] || key;
}
