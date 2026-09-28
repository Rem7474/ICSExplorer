// Known disciplines with defined CSS variables in main.css
export const KNOWN_DISCIPLINES = [
  "IN",
  "TE",
  "SN",
  "PR",
  "MT",
  "LV",
  "XP",
  "AU",
  "EP",
  "MAC",
  "SP",
  "PT",
  "HU",
];

// Special fixed labels only for non-course external event sources
export const SUBJECT_NAMES = {
  CERCLE: "Cercle des Élèves",
  RU: "RU Briff'O (CROUS)",
};

// Curated harmonious color palette for other disciplines or courses
const GENERAL_PALETTE = [
  {
    // Blue / Indigo
    light: { background: "rgba(99, 102, 241, 0.12)", border: "#6366f1", text: "#1e1b4b", subtext: "#4338ca", accent: "#6366f1" },
    dark: { background: "rgba(99, 102, 241, 0.18)", border: "#818cf8", text: "#f5f3ff", subtext: "#c7d2fe", accent: "#818cf8" },
  },
  {
    // Purple / Violet
    light: { background: "rgba(139, 92, 246, 0.12)", border: "#8b5cf6", text: "#4c1d95", subtext: "#6d28d9", accent: "#8b5cf6" },
    dark: { background: "rgba(139, 92, 246, 0.18)", border: "#a78bfa", text: "#f5f3ff", subtext: "#ddd6fe", accent: "#a78bfa" },
  },
  {
    // Emerald / Green
    light: { background: "rgba(16, 185, 129, 0.12)", border: "#10b981", text: "#064e3b", subtext: "#047857", accent: "#10b981" },
    dark: { background: "rgba(16, 185, 129, 0.18)", border: "#34d399", text: "#ecfdf5", subtext: "#a7f3d0", accent: "#34d399" },
  },
  {
    // Amber / Warm Yellow
    light: { background: "rgba(245, 158, 11, 0.12)", border: "#f59e0b", text: "#78350f", subtext: "#b45309", accent: "#f59e0b" },
    dark: { background: "rgba(245, 158, 11, 0.18)", border: "#fbbf24", text: "#fffbeb", subtext: "#fde68a", accent: "#fbbf24" },
  },
  {
    // Rose / Coral
    light: { background: "rgba(244, 63, 94, 0.12)", border: "#f43f5e", text: "#881337", subtext: "#be123c", accent: "#f43f5e" },
    dark: { background: "rgba(244, 63, 94, 0.18)", border: "#fb7185", text: "#fff1f2", subtext: "#fecdd3", accent: "#fb7185" },
  },
  {
    // Cyan / Teal
    light: { background: "rgba(6, 182, 212, 0.12)", border: "#06b6d4", text: "#164e63", subtext: "#0e7490", accent: "#06b6d4" },
    dark: { background: "rgba(6, 182, 212, 0.18)", border: "#22d3ee", text: "#ecfeff", subtext: "#cffafe", accent: "#22d3ee" },
  },
  {
    // Orange
    light: { background: "rgba(249, 115, 22, 0.12)", border: "#f97316", text: "#7c2d12", subtext: "#c2410c", accent: "#f97316" },
    dark: { background: "rgba(249, 115, 22, 0.18)", border: "#fb923c", text: "#fff7ed", subtext: "#ffedd5", accent: "#fb923c" },
  },
  {
    // Fuchsia
    light: { background: "rgba(217, 70, 239, 0.12)", border: "#d946ef", text: "#701a75", subtext: "#a21caf", accent: "#d946ef" },
    dark: { background: "rgba(217, 70, 239, 0.18)", border: "#e879f9", text: "#fdf4ff", subtext: "#f5d0fe", accent: "#e879f9" },
  },
  {
    // Sky Blue
    light: { background: "rgba(14, 165, 233, 0.12)", border: "#0ea5e9", text: "#0c4a6e", subtext: "#0369a1", accent: "#0ea5e9" },
    dark: { background: "rgba(14, 165, 233, 0.18)", border: "#38bdf8", text: "#f0f9ff", subtext: "#bae6fd", accent: "#38bdf8" },
  },
  {
    // Teal
    light: { background: "rgba(20, 184, 166, 0.12)", border: "#14b8a6", text: "#134e4a", subtext: "#0f766e", accent: "#14b8a6" },
    dark: { background: "rgba(20, 184, 166, 0.18)", border: "#2dd4bf", text: "#f0fdfa", subtext: "#99f6e4", accent: "#2dd4bf" },
  },
];

export const stringToHash = (str) => {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const normalizeCourseTitle = (rawSummary) => {
  if (!rawSummary) return "";
  let s = String(rawSummary).trim();

  // Strip leading stars, hashes, dashes or bullet points
  s = s.replace(/^[\s*#~_—\-•]+/, "");

  // Strip bracketed promo tags (e.g. "[M1 MSI] ")
  s = s.replace(/^\[[^\]]+\]\s*/, "");

  // Strip session type prefixes (e.g. "CM - ", "TD : ", "TP ", "COURS ")
  s = s.replace(/^(CM|TD|TP|COURS|CONF|CONFERENCE|EXAM|EXAMEN|EVALUATION|RATTRAPAGE|SOUTENANCE)[\s:-]+/i, "");

  // Strip trailing group suffixes (e.g. " - Groupe 1", " (Grp A)", " - TD1")
  s = s.replace(/[\s:-]+(GROUPE|GRP|GR|TD|TP)\s*[\d\w]*$/i, "");

  return s.trim();
};

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
    s.includes("rally") ||
    s.includes("rentrée de l'étudiant") ||
    s.includes("rentree de l'etudiant") ||
    s.includes("bbq") ||
    s.includes("afterwork")
  );
};

export const isRuEvent = (eventOrSummary) => {
  if (!eventOrSummary) return false;
  if (typeof eventOrSummary === "object") {
    if (eventOrSummary.isRu) return true;
    if (eventOrSummary.categories && (eventOrSummary.categories.toUpperCase().includes("RU") || eventOrSummary.categories.toUpperCase().includes("CROUS"))) {
      return true;
    }
    if (eventOrSummary.source && (eventOrSummary.source.toUpperCase().includes("RU") || eventOrSummary.source.toUpperCase().includes("BRIFF"))) {
      return true;
    }
    return isRuEvent(eventOrSummary.summary);
  }

  const s = String(eventOrSummary).toLowerCase();
  return (
    s.includes("ru briff") ||
    s.includes("ru briff'o") ||
    s.includes("briffo") ||
    s.includes("🍽️ ru") ||
    s.includes("menu ru")
  );
};

/**
 * Extracts specific course module code (e.g. "IN331", "TE510", "PIN50", "MT321") from an event or summary.
 */
export const extractModuleCode = (eventOrSummary) => {
  if (!eventOrSummary) return null;
  const raw = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary);
  const cleaned = normalizeCourseTitle(raw);

  const match = cleaned.match(/^([A-Z]{2,5}\d{2,4}(?:-[A-Za-z0-9]+)?)\b/i);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
};

/**
 * Resolves the 2-letter discipline code extracted directly from the course code, used for coloring.
 * No heuristic guessing of full names: solely extracts the 2 letters.
 */
export const getDiscipline = (typeOrSummary) => {
  if (!typeOrSummary) return "DEFAULT";
  if (isRuEvent(typeOrSummary)) return "RU";
  if (isCercleEvent(typeOrSummary)) return "CERCLE";

  const raw = typeof typeOrSummary === "object" ? typeOrSummary.summary || "" : String(typeOrSummary);
  const code = extractModuleCode(raw);
  if (code) {
    // Project codes starting with P followed by discipline (e.g. PIN50 -> IN, PAU50 -> AU, PEP50 -> EP, PSN50 -> SN)
    if (/^P[A-Z]{2}\d/i.test(code)) {
      return code.slice(1, 3).toUpperCase();
    }
    // Standard 2-letter discipline prefix (e.g. IN331 -> IN, TE510 -> TE, AU331 -> AU, EP331 -> EP, MT321 -> MT, LV01 -> LV)
    if (/^[A-Z]{2}/i.test(code)) {
      return code.slice(0, 2).toUpperCase();
    }
  }

  // If a discipline identifier was passed directly (e.g. "IN", "TE", "MAC", "MT")
  const trimmed = raw.trim().toUpperCase();
  if (KNOWN_DISCIPLINES.includes(trimmed)) {
    return trimmed;
  }
  if (/^[A-Z]{2,4}$/.test(trimmed)) {
    return trimmed;
  }

  return "DEFAULT";
};

/**
 * Returns the subject type: module code when present (e.g. "IN331", "TE510"),
 * or normalized course name otherwise.
 */
export const getSubjectType = (eventOrSummary) => {
  if (!eventOrSummary) return "DEFAULT";
  if (isRuEvent(eventOrSummary)) {
    return "RU";
  }
  if (isCercleEvent(eventOrSummary)) {
    return "CERCLE";
  }

  // Extract specific module code (e.g. IN331, TE510, PIN50, AU331, MT321...)
  const moduleCode = extractModuleCode(eventOrSummary);
  if (moduleCode) {
    return moduleCode;
  }

  // Fallback to normalized title
  const rawSummary = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary);
  const cleaned = normalizeCourseTitle(rawSummary);
  if (cleaned.length > 0) {
    return cleaned.toUpperCase();
  }

  return "DEFAULT";
};

/**
 * Returns human-readable subject name: keeps the code or exact title as is,
 * without artificial or guessed heuristic translations.
 */
export const getSubjectFullName = (type) => {
  if (!type || type === "DEFAULT") return "Autre";
  if (SUBJECT_NAMES[type]) return SUBJECT_NAMES[type];

  // Return the code / title directly
  return type;
};

export const getSubjectColors = (eventOrSummary, isDarkMode = false) => {
  if (isRuEvent(eventOrSummary)) {
    return {
      background: isDarkMode ? "#431407" : "#ffedd5",
      border: isDarkMode ? "#fb923c" : "#ea580c",
      text: isDarkMode ? "#fff7ed" : "#7c2d12",
      subtext: isDarkMode ? "#fed7aa" : "#9a3412",
      accent: isDarkMode ? "#f97316" : "#ea580c",
    };
  }

  if (isCercleEvent(eventOrSummary)) {
    return {
      background: isDarkMode ? "#3b174a" : "#f5e8ff",
      border: isDarkMode ? "#c084fc" : "#a855f7",
      text: isDarkMode ? "#f5e8ff" : "#581c87",
      subtext: isDarkMode ? "#e9d5ff" : "#7e22ce",
      accent: "#9333ea",
    };
  }

  const disc = getDiscipline(eventOrSummary);
  if (KNOWN_DISCIPLINES.includes(disc)) {
    return {
      background: `var(--color-${disc})`,
      border: `var(--border-${disc})`,
      text: isDarkMode ? "#f1f5f9" : "#0f172a",
      subtext: isDarkMode ? "#cbd5e1" : "#475569",
      accent: `var(--border-${disc})`,
    };
  }

  // Deterministic palette based on the 2-letter discipline prefix (or normalized title if no discipline)
  const rawSummary = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary || "");
  const normalized = normalizeCourseTitle(rawSummary);
  const hashKey = disc !== "DEFAULT" ? disc : normalized;
  const hash = stringToHash(hashKey);
  const theme = GENERAL_PALETTE[hash % GENERAL_PALETTE.length];
  const modeTheme = isDarkMode ? theme.dark : theme.light;

  return {
    background: modeTheme.background,
    border: modeTheme.border,
    text: modeTheme.text,
    subtext: modeTheme.subtext,
    accent: modeTheme.border,
  };
};
