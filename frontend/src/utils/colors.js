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
    light: { background: "#eff6ff", border: "#3b82f6", text: "#1e3a8a", subtext: "#2563eb" },
    dark: { background: "#1e293b", border: "#60a5fa", text: "#f8fafc", subtext: "#93c5fd" },
  },
  {
    // Purple / Violet
    light: { background: "#f5f3ff", border: "#8b5cf6", text: "#4c1d95", subtext: "#7c3aed" },
    dark: { background: "#2e1065", border: "#a78bfa", text: "#f5f3ff", subtext: "#c4b5fd" },
  },
  {
    // Emerald / Green
    light: { background: "#ecfdf5", border: "#10b981", text: "#064e3b", subtext: "#059669" },
    dark: { background: "#064e3b", border: "#34d399", text: "#ecfdf5", subtext: "#6ee7b7" },
  },
  {
    // Amber / Warm Yellow
    light: { background: "#fffbeb", border: "#f59e0b", text: "#78350f", subtext: "#d97706" },
    dark: { background: "#451a03", border: "#fbbf24", text: "#fffbeb", subtext: "#fde68a" },
  },
  {
    // Rose / Coral
    light: { background: "#fff1f2", border: "#f43f5e", text: "#881337", subtext: "#e11d48" },
    dark: { background: "#4c0519", border: "#fb7185", text: "#fff1f2", subtext: "#fda4af" },
  },
  {
    // Cyan / Teal
    light: { background: "#ecfeff", border: "#06b6d4", text: "#164e63", subtext: "#0891b2" },
    dark: { background: "#083344", border: "#22d3ee", text: "#ecfeff", subtext: "#67e8f9" },
  },
  {
    // Orange
    light: { background: "#fff7ed", border: "#f97316", text: "#7c2d12", subtext: "#ea580c" },
    dark: { background: "#431407", border: "#fb923c", text: "#fff7ed", subtext: "#fdba74" },
  },
  {
    // Fuchsia
    light: { background: "#fdf4ff", border: "#d946ef", text: "#701a75", subtext: "#c026d3" },
    dark: { background: "#4a044e", border: "#e879f9", text: "#fdf4ff", subtext: "#f0abfc" },
  },
  {
    // Sky Blue
    light: { background: "#f0f9ff", border: "#0284c7", text: "#0c4a6e", subtext: "#0369a1" },
    dark: { background: "#082f49", border: "#38bdf8", text: "#f0f9ff", subtext: "#7dd3fc" },
  },
  {
    // Lime / Fresh Green
    light: { background: "#f7fee7", border: "#84cc16", text: "#365314", subtext: "#65a30d" },
    dark: { background: "#1a2e05", border: "#a3e635", text: "#f7fee7", subtext: "#bef264" },
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

  // 2. Clean out course type prefixes (CM, TD, TP, [Promo], etc.)
  const cleaned = trimmed
    .replace(/^\[[^\]]+\]\s*/i, "")
    .replace(/^(CM|TD|TP|COURS|CONF|EXAM|EVALUATION|RATTRAPAGE)[\s:-]+/i, "")
    .trim();

  const upper = cleaned.toUpperCase();

  // 3. Match universal educational domains
  if (/\b(MATH|MATHS|STAT|PROBA|ALGEBRE|ANALYSE)\b/i.test(upper)) return "PR";
  if (/\b(INFO|INFORMATIQUE|DEV|PROGRAMMATION|ALGO|ALGORITHME|WEB|PYTHON|JAVA|DATA|BDD|CYBER|RESEAU)\b/i.test(upper)) return "IN";
  if (/\b(MANAGEMENT|GESTION|MARKETING|FINANCE|COMPTABILITE|RH|COMMUNICATION|DROIT|JURIDIQUE|ECONOMIE|ECO|AUDIT|STRATEGIE)\b/i.test(upper)) return "MAC";
  if (/\b(ANGLAIS|ENGLISH|ESPAGNOL|ALLEMAND|CHINOIS|FLE|LANGUE|TOEIC)\b/i.test(upper)) return "LV";
  if (/\b(PHYSIQUE|ELECTRONIQUE|ELEC|OPTIQUE|MECANIQUE|ENERGIE)\b/i.test(upper)) return "EP";
  if (/\b(AUTOMATIQUE|ROBOTIQUE|ASSERVISSEMENT)\b/i.test(upper)) return "AU";
  if (/\b(PROJET|ATELIER|WORKSHOP|STAGE|MISSION)\b/i.test(upper)) return "XP";
  if (/\b(SPORT|EPS|FITNESS|BADMINTON|ESCALADE|VOLLEY)\b/i.test(upper)) return "SP";

  // 4. Group by primary course keywords (e.g. "ARCHITECTURE SI", "GOUVERNANCE DONNEES")
  const words = cleaned
    .split(/[\s,;:/-]+/)
    .filter((w) => w.length > 2 && !/^(les|des|une|pour|avec|sur|dans|cours|groupe|grp|grp1|grp2|promo)$/i.test(w));

  if (words.length > 0) {
    return words.slice(0, 2).join(" ").toUpperCase();
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

  // Deterministic harmonious palette for all other courses
  const summary = typeof eventOrSummary === "object" ? eventOrSummary.summary || "" : String(eventOrSummary || "");
  const hashKey = type !== "DEFAULT" ? type : summary;
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
