import { setSelectOptions } from "../utils/dom.js";
import { getUnique } from "../utils/collections.js";

export const isStudentType = (typeValue) =>
  String(typeValue || "").toLowerCase().includes("eleve");

export const getStudentFiles = (items) => {
  const studentItems = items.filter((item) => isStudentType(item.type));
  const source = studentItems.length ? studentItems : items;
  return source.map((item) => item.file);
};

export const normalizeFiles = (files) =>
  files
    .map((file) => {
      const base = file.replace(/\.ics$/i, "");
      const normalized = base.replace(/\s*-\s*/g, "-");
      const parts = normalized.split("-");
      const [year, track, type, ...restParts] = parts;
      return {
        file,
        year: year || "",
        track: track || "",
        type: type || "",
        rest: restParts.length ? restParts.join("-") : "(général)",
      };
    })
    .filter((item) => item.year && item.track && item.type);

/**
 * Cascade Année → Parcours → Type → Suite.
 * Émet onComplete(match) quand la sélection est complète et valide.
 *
 * Méthodes exposées :
 *   setAvailableFiles(rawFiles)  — recharge le pool et reset les selects
 *   applyPartialSelection(params) — pousse une sélection (year/track/type/rest)
 *   triggerLoad()                — relance onComplete si sélection complète
 *   getSelection()               — { year, track, type, rest }
 *   getAvailableFiles()          — items normalisés
 */
export const createFileCascade = ({
  yearSelect,
  trackSelect,
  typeSelect,
  fileSelect,
  onComplete,
}) => {
  let availableFiles = [];

  const findMatch = ({ year, track, type, rest }) =>
    availableFiles.find(
      (item) =>
        item.year === year &&
        item.track === track &&
        item.type === type &&
        item.rest === rest
    );

  const getSelection = () => ({
    year: yearSelect.value,
    track: trackSelect.value,
    type: typeSelect.value,
    rest: fileSelect.value,
  });

  const updateTrackOptions = () => {
    const year = yearSelect.value;
    const tracks = getUnique(
      availableFiles
        .filter((item) => item.year === year)
        .map((item) => item.track)
    );
    setSelectOptions(trackSelect, "Parcours…", tracks, !year);
    setSelectOptions(typeSelect, "Type…", [], true);
    setSelectOptions(fileSelect, "Suite…", [], true);
  };

  const updateTypeOptions = () => {
    const year = yearSelect.value;
    const track = trackSelect.value;
    const types = getUnique(
      availableFiles
        .filter((item) => item.year === year && item.track === track)
        .map((item) => item.type)
    );
    setSelectOptions(typeSelect, "Type…", types, !track);
    setSelectOptions(fileSelect, "Suite…", [], true);
  };

  const updateFileOptions = () => {
    const year = yearSelect.value;
    const track = trackSelect.value;
    const type = typeSelect.value;
    const rests = getUnique(
      availableFiles
        .filter(
          (item) =>
            item.year === year && item.track === track && item.type === type
        )
        .map((item) => item.rest)
    );
    setSelectOptions(fileSelect, "Suite…", rests, !type);
  };

  const handleFileChange = () => {
    const sel = getSelection();
    if (!sel.year || !sel.track || !sel.type || !sel.rest) return;
    const match = findMatch(sel);
    if (match && onComplete) onComplete(match);
  };

  yearSelect.addEventListener("change", updateTrackOptions);
  trackSelect.addEventListener("change", updateTypeOptions);
  typeSelect.addEventListener("change", updateFileOptions);
  fileSelect.addEventListener("change", handleFileChange);

  const setAvailableFiles = (rawFiles) => {
    availableFiles = normalizeFiles(rawFiles);
    if (!availableFiles.length) {
      setSelectOptions(yearSelect, "Aucun fichier ICS trouvé", [], true);
      setSelectOptions(trackSelect, "Parcours…", [], true);
      setSelectOptions(typeSelect, "Type…", [], true);
      setSelectOptions(fileSelect, "Suite…", [], true);
      return;
    }
    const years = getUnique(availableFiles.map((item) => item.year));
    setSelectOptions(yearSelect, "Année…", years, false);
    setSelectOptions(trackSelect, "Parcours…", [], true);
    setSelectOptions(typeSelect, "Type…", [], true);
    setSelectOptions(fileSelect, "Suite…", [], true);
  };

  const applyPartialSelection = ({ year, track, type, rest }) => {
    if (year) {
      yearSelect.value = year;
      updateTrackOptions();
    }
    if (track) {
      trackSelect.value = track;
      updateTypeOptions();
    }
    if (type) {
      typeSelect.value = type;
      updateFileOptions();
    }
    if (rest) {
      fileSelect.value = rest;
    }
  };

  const triggerLoad = () => handleFileChange();

  return {
    setAvailableFiles,
    applyPartialSelection,
    triggerLoad,
    getSelection,
    getAvailableFiles: () => availableFiles,
  };
};
