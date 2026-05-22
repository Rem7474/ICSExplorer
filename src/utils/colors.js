export const getSubjectType = (summary) => {
  if (!summary) return "";
  const match = summary.match(/^([A-Z]{2,3})/);
  return match ? match[1] : "";
};

export const getSubjectCode = (summary) => {
  if (!summary) return "";
  const match = summary.match(/^([A-Z]{2,3}\d{2,4})/);
  return match ? match[1] : "";
};

export const getSubjectNumber = (summary) => {
  if (!summary) return null;
  const match = summary.match(/^[A-Z]{2,3}(\d{2,4})/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
};

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const hexToHsl = (hex) => {
  const cleaned = hex.replace("#", "");
  const expanded =
    cleaned.length === 3
      ? cleaned.split("").map((c) => c + c).join("")
      : cleaned;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fallbackColors = {
  background: "var(--card)",
  border: "var(--accent)",
  text: "var(--text)",
  subtext: "var(--muted)",
};

// Cache: clé = "type|code|number|theme" → colors
const colorCache = new Map();

export const invalidateColorCache = () => colorCache.clear();

export const getSubjectColors = (summary) => {
  const type = getSubjectType(summary) || "IN";
  const code = getSubjectCode(summary) || type;
  const number = getSubjectNumber(summary);

  const root = document.documentElement;
  const isDarkTheme = root.classList.contains("dark-mode");
  const cacheKey = `${type}|${code}|${number ?? "x"}|${isDarkTheme ? "d" : "l"}`;
  const cached = colorCache.get(cacheKey);
  if (cached) return cached;

  const styles = getComputedStyle(root);
  const baseHex = styles.getPropertyValue(`--border-${type}`).trim();
  if (!baseHex) {
    colorCache.set(cacheKey, fallbackColors);
    return fallbackColors;
  }

  const base = hexToHsl(baseHex);
  const bgHex = styles.getPropertyValue("--bg").trim();
  const isDark = bgHex && hexToHsl(bgHex).l < 50;
  const typeSeed = hashString(type);
  const codeSeed = hashString(code);
  const numberShift = number !== null ? ((number % 100) - 50) * 1.2 : 0;
  const typeShift = (typeSeed % 19) - 9;
  const hueShift = numberShift + typeShift;
  const satShift = (codeSeed % 31) - 15;
  const lightShift = (codeSeed % 21) - 10;

  const borderLight = isDark
    ? clamp(base.l + lightShift, 45, 80)
    : clamp(base.l + lightShift, 28, 72);
  const bgLight = isDark
    ? clamp(base.l - 18 + lightShift * 0.4, 18, 40)
    : clamp(base.l + 24 + lightShift * 0.6, 65, 92);

  const isBgDark = bgLight < 55;
  const text = isBgDark ? "hsl(210 20% 96%)" : "hsl(210 25% 16%)";
  const subtext = isBgDark ? "hsl(210 15% 82%)" : "hsl(210 15% 32%)";

  const hue = (base.h + hueShift + 360) % 360;
  const border = `hsl(${hue} ${clamp(base.s + satShift, 35, 90)}% ${borderLight}%)`;
  const background = `hsl(${hue} ${clamp(base.s - 15 + satShift * 0.4, 20, 70)}% ${bgLight}%)`;

  const result = { background, border, text, subtext };
  colorCache.set(cacheKey, result);
  return result;
};
