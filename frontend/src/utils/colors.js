const KNOWN_PREFIXES = ["IN", "SN", "PR", "LV", "XP", "AU", "EP", "MAC", "SP", "PT"];

export const isCercleEvent = (eventOrSummary) => {
  if (!eventOrSummary) return false;
  if (typeof eventOrSummary === "object") {
    if (eventOrSummary.isCercle) return true;
    if (eventOrSummary.categories && eventOrSummary.categories.toUpperCase().includes("CERCLE")) return true;
    if (eventOrSummary.source && eventOrSummary.source.toUpperCase().includes("CERCLE")) return true;
    return isCercleEvent(eventOrSummary.summary);
  }

  const s = String(eventOrSummary).toLowerCase();
  return (
    s.includes("cercle") ||
    s.includes("gala") ||
    s.includes("wei") ||
    s.includes("soiree") ||
    s.includes("soirée") ||
    s.includes("déjeuner") ||
    s.includes("dejeuner") ||
    s.includes("inter-assos") ||
    s.includes("club") ||
    s.includes("foyer") ||
    s.includes("parainage") ||
    s.includes("parrainage") ||
    s.includes("rally")
  );
};

export const getSubjectType = (eventOrSummary) => {
  if (!eventOrSummary) return "DEFAULT";
  if (isCercleEvent(eventOrSummary)) {
    return "CERCLE";
  }

  const summary = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary);
  const trimmed = summary.trim();

  for (const prefix of KNOWN_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return prefix;
    }
  }

  return "DEFAULT";
};

export const getSubjectColors = (eventOrSummary, isDarkMode = false) => {
  const type = getSubjectType(eventOrSummary);

  if (type === "CERCLE") {
    return {
      background: isDarkMode ? "#3b174a" : "#f5e8ff",
      border: isDarkMode ? "#c084fc" : "#a855f7",
      text: isDarkMode ? "#f5e8ff" : "#581c87",
      subtext: isDarkMode ? "#e9d5ff" : "#7e22ce",
      accent: "#9333ea",
    };
  }

  if (KNOWN_PREFIXES.includes(type)) {
    return {
      background: `var(--color-${type})`,
      border: `var(--border-${type})`,
      text: isDarkMode ? "#f1f5f9" : "#0f172a",
      subtext: isDarkMode ? "#cbd5e1" : "#475569",
      accent: `var(--border-${type})`,
    };
  }

  return {
    background: isDarkMode ? "#1e293b" : "#f1f5f9",
    border: isDarkMode ? "#475569" : "#cbd5e1",
    text: isDarkMode ? "#f8fafc" : "#1e293b",
    subtext: isDarkMode ? "#94a3b8" : "#64748b",
    accent: isDarkMode ? "#64748b" : "#94a3b8",
  };
};
