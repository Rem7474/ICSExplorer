const KNOWN_PREFIXES = ["IN", "SN", "PR", "LV", "XP", "AU", "EP", "MAC", "SP", "PT"];

export const SUBJECT_NAMES = {
  IN: "Informatique",
  SN: "Signal & Numérique",
  PR: "Maths & Sciences",
  LV: "Langues Vivantes",
  XP: "Projets & Expérimentations",
  AU: "Automatique",
  EP: "Électronique & Physique",
  MAC: "Management & Gestion",
  SP: "Sport & EPS",
  PT: "Projets Techniques",
  CERCLE: "Cercle des Élèves",
  DEFAULT: "Autre",
};

// Curated harmonious color palette for non-Esisar & general university courses
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

export const getSubjectFullName = (type) => {
  if (SUBJECT_NAMES[type]) return SUBJECT_NAMES[type];
  if (!type || type === "DEFAULT") return "Autre";

  // Clean and capitalize dynamic subject titles
  return type
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
    s.includes("rally")
  );
};

export const normalizeCourseTitle = (rawSummary) => {
  if (!rawSummary) return "";
  let s = String(rawSummary).trim();

  // Strip leading stars, hashes, dashes or bullet points (e.g. "***Strategic Management" -> "Strategic Management")
  s = s.replace(/^[\s*#~_—\-•]+/, "");

  // Strip bracketed promo tags (e.g. "[M1 MSI] ")
  s = s.replace(/^\[[^\]]+\]\s*/, "");

  // Strip session type prefixes (e.g. "CM - ", "TD : ", "TP ", "COURS ")
  s = s.replace(/^(CM|TD|TP|COURS|CONF|CONFERENCE|EXAM|EXAMEN|EVALUATION|RATTRAPAGE|SOUTENANCE)[\s:-]+/i, "");

  // Strip trailing group suffixes (e.g. " - Groupe 1", " (Grp A)", " - TD1")
  s = s.replace(/[\s:-]+(GROUPE|GRP|GR|TD|TP)\s*[\d\w]*$/i, "");

  return s.trim();
};

export const getSubjectType = (eventOrSummary) => {
  if (!eventOrSummary) return "DEFAULT";
  if (isCercleEvent(eventOrSummary)) {
    return "CERCLE";
  }

  const rawSummary = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary);
  const trimmed = rawSummary.trim();

  // 1. Check exact Esisar prefixes (IN101, LV01, PR301...)
  for (const prefix of KNOWN_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return prefix;
    }
  }

  // 2. Clean out course type prefixes & symbols
  const cleaned = normalizeCourseTitle(trimmed);
  const upper = cleaned.toUpperCase();

  // 3. Match universal educational domains
  if (/\b(MATH|MATHS|STAT|PROBA|ALGEBRE|ANALYSE)\b/i.test(upper)) return "PR";
  if (/\b(INFO|INFORMATIQUE|DEV|PROGRAMMATION|ALGO|ALGORITHME|WEB|PYTHON|JAVA|DATA|BDD|CYBER|RESEAU|BASE DE DONNEES|BASES DE DONNEES|SYSTEME D'INFORMATION|SYSTEMES D'INFORMATION)\b/i.test(upper)) return "IN";
  if (/\b(MANAGEMENT|GESTION|MARKETING|FINANCE|COMPTABILITE|RH|COMMUNICATION|DROIT|JURIDIQUE|ECONOMIE|ECO|AUDIT|STRATEGIE|STRATEGIC)\b/i.test(upper)) return "MAC";
  if (/\b(ANGLAIS|ENGLISH|ESPAGNOL|ALLEMAND|CHINOIS|FLE|LANGUE|TOEIC)\b/i.test(upper)) return "LV";
  if (/\b(PHYSIQUE|ELECTRONIQUE|ELEC|OPTIQUE|MECANIQUE|ENERGIE)\b/i.test(upper)) return "EP";
  if (/\b(AUTOMATIQUE|ROBOTIQUE|ASSERVISSEMENT)\b/i.test(upper)) return "AU";
  if (/\b(PROJET|ATELIER|WORKSHOP|STAGE|MISSION)\b/i.test(upper)) return "XP";
  if (/\b(SPORT|EPS|FITNESS|BADMINTON|ESCALADE|VOLLEY)\b/i.test(upper)) return "SP";

  // 4. Fallback to normalized title as category key
  if (cleaned.length > 0) {
    return upper;
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

  // Deterministic harmonious palette for all other courses based on normalized title hash
  const rawSummary = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary || "");
  const normalized = normalizeCourseTitle(rawSummary);
  const hashKey = type !== "DEFAULT" ? type : normalized;
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
