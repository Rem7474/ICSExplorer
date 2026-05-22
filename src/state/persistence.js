const STORAGE_KEY = "edtSelection";
const URL_KEYS = ["mode", "year", "track", "type", "rest"];

export const loadSelection = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

export const saveSelection = (selection) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
};

export const readUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return URL_KEYS.reduce((acc, key) => {
    acc[key] = params.get(key);
    return acc;
  }, {});
};

export const writeUrlParams = ({ mode, year, track, type, rest }) => {
  const url = new URL(window.location);
  if (mode) url.searchParams.set("mode", mode);
  if (year && track && type && rest) {
    url.searchParams.set("year", year);
    url.searchParams.set("track", track);
    url.searchParams.set("type", type);
    url.searchParams.set("rest", rest);
  }
  window.history.replaceState({}, "", url);
};

export const mergeSelectionSources = () => {
  const stored = loadSelection();
  const urlParams = readUrlParams();
  const filteredUrlParams = Object.fromEntries(
    Object.entries(urlParams).filter(([, v]) => v !== null)
  );
  return { ...stored, ...filteredUrlParams };
};
