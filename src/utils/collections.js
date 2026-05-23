export const getUnique = (values) =>
  [...new Set(values)].sort((a, b) =>
    a.localeCompare(b, "fr", { numeric: true })
  );
