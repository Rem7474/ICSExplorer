export const getOutputBase = () => {
  if (typeof window !== "undefined" && window.__EDT_CONFIG__?.outputBase) {
    return window.__EDT_CONFIG__.outputBase;
  }
  return "/output/";
};

export const fileUrl = (fileName) => {
  const base = getOutputBase();
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  return `${cleanBase}${encodeURIComponent(fileName)}`;
};

export const cleanMojibake = (str) => {
  if (!str) return "";
  return str
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã /g, "à")
    .replace(/Ã¹/g, "ù")
    .replace(/Ã¢/g, "â")
    .replace(/Ãª/g, "ê")
    .replace(/Ã®/g, "î")
    .replace(/Ã´/g, "ô")
    .replace(/Ã»/g, "û")
    .replace(/Ã§/g, "ç")
    .replace(/Ã«/g, "ë")
    .replace(/Ã¯/g, "ï")
    .replace(/Ã‰/g, "É")
    .replace(/Ãˆ/g, "È")
    .replace(/Ã€/g, "À")
    .replace(/Ã‡/g, "Ç")
    .replace(/Â°/g, "°");
};

export const decodeTextWithFallback = async (response) => {
  const buffer = await response.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buffer);
  if (text.includes("\uFFFD")) {
    text = new TextDecoder("iso-8859-1").decode(buffer);
  }
  return cleanMojibake(text);
};

export const fetchIcsText = async (fileName) => {
  const url = fileUrl(fileName);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Impossible de récupérer le fichier (HTTP ${response.status})`);
  }
  return decodeTextWithFallback(response);
};

export const fetchUniversities = async () => {
  const resp = await fetch("/api/universities", { cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Impossible de récupérer la liste des universités (HTTP ${resp.status})`);
  }
  return resp.json();
};

export const fetchTreeNodes = async ({ universityId, adeUrl, login, password, branchId, branchPath, category }) => {
  const resp = await fetch("/api/tree", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ universityId, adeUrl, login, password, branchId, branchPath, category }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Impossible de récupérer l'arborescence ADE (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  return data.nodes || [];
};

export const fetchPersonalCalendar = async ({ universityId, adeUrl, resourceId, login, password }) => {
  const resp = await fetch("/api/personal-calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ universityId, adeUrl, resourceId, login, password }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `Impossible de récupérer votre emploi du temps (HTTP ${resp.status})`);
  }

  return decodeTextWithFallback(resp);
};

export const fetchFileList = async () => {
  // Strategy 1: Dedicated backend endpoint /api/files
  try {
    const apiResp = await fetch("/api/files", { cache: "no-store" });
    if (apiResp.ok) {
      const list = await apiResp.json();
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch {}

  // Strategy 2: files.json static index
  try {
    const jsonUrl = `${getOutputBase().replace(/\/$/, "")}/files.json`;
    const jsonResp = await fetch(jsonUrl, { cache: "no-store" });
    if (jsonResp.ok) {
      const data = await jsonResp.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.filter((s) => typeof s === "string" && s.endsWith(".ics"));
      }
    }
  } catch {}

  // Strategy 3: HTML directory listing fallback
  try {
    const htmlResp = await fetch(getOutputBase(), { cache: "no-store" });
    if (htmlResp.ok) {
      const html = await decodeTextWithFallback(htmlResp);
      const links = Array.from(html.matchAll(/href=["']([^"']+\.ics)["']/gi)).map((m) => m[1]);
      return [...new Set(links)]
        .map((link) => link.replace(/^.*\//, ""))
        .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    }
  } catch {}

  throw new Error("Impossible de récupérer la liste des fichiers.");
};
