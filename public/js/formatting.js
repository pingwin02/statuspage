function formatDateTime(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${values.day}.${values.month}.${values.year} ${values.hour}:${values.minute}`;
  } catch {
    return date.toLocaleString();
  }
}

function formatDateTimeWithSeconds(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${values.day}.${values.month}.${values.year} ${values.hour}:${values.minute}:${values.second}`;
  } catch {
    return date.toLocaleString();
  }
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  if (absDiff < 1000) {
    return translations[currentLang].relative_time.now;
  }

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  const isFuture = diff > 0;
  const tr = translations[currentLang].relative_time;

  const getPluralForm = (count, singular, few, many) => {
    if (currentLang === "en") {
      return count === 1 ? singular : many;
    }

    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) return singular;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return few;
    }

    return many;
  };

  if (seconds < 60) {
    const s = getPluralForm(
      seconds,
      tr.second.singular,
      tr.second.few,
      tr.second.many,
    );
    return isFuture
      ? `${tr.futurePrefix}${seconds} ${s}`
      : `${seconds} ${s}${tr.pastSuffix}`;
  } else if (minutes < 60) {
    const m = getPluralForm(
      minutes,
      tr.minute.singular,
      tr.minute.few,
      tr.minute.many,
    );
    return isFuture
      ? `${tr.futurePrefix}${minutes} ${m}`
      : `${minutes} ${m}${tr.pastSuffix}`;
  } else if (hours < 24) {
    const h = getPluralForm(hours, tr.hour.singular, tr.hour.few, tr.hour.many);
    return isFuture
      ? `${tr.futurePrefix}${hours} ${h}`
      : `${hours} ${h}${tr.pastSuffix}`;
  } else {
    const d = getPluralForm(days, tr.day.singular, tr.day.few, tr.day.many);
    return isFuture
      ? `${tr.futurePrefix}${days} ${d}`
      : `${days} ${d}${tr.pastSuffix}`;
  }
}

function parseDateTimeInTimeZone(value, timeZone) {
  if (!value) return null;

  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = "0"] = timePart.split(":").map(Number);
  if ([year, month, day, hour, minute, second].some(Number.isNaN)) return null;

  try {
    const utcGuess = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second),
    );
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(utcGuess);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const assumedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second || 0),
    );
    return new Date(utcGuess.getTime() - (assumedUtc - utcGuess.getTime()));
  } catch {
    return new Date(value);
  }
}
