export const outputBase = "https://edt.remcorp.fr/output/";

export const decodeTextWithFallback = async (response) => {
  const buffer = await response.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (utf8.includes("�")) {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
  return utf8;
};

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const decodeHtmlEntities = (value) => {
  if (!value) return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
};

export const extractIcsLinks = (html) => {
  const links = Array.from(html.matchAll(/href=["']([^"']+\.ics)["']/gi)).map(
    (match) => match[1]
  );
  return [...new Set(links)]
    .map((link) => link.replace(/^.*\//, ""))
    .map(decodeHtmlEntities)
    .map(safeDecodeURIComponent)
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
};

export const fileUrl = (fileName) =>
  `${outputBase}${encodeURIComponent(fileName)}`;

export const fetchIcsText = async (fileName) => {
  const response = await fetch(fileUrl(fileName));
  if (!response.ok) throw new Error("Impossible de récupérer le fichier.");
  return decodeTextWithFallback(response);
};

export const fetchFileListHtml = async () => {
  const response = await fetch(outputBase, { cache: "no-store" });
  if (!response.ok) throw new Error("Répertoire inaccessible");
  return decodeTextWithFallback(response);
};
