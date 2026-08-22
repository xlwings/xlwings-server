export function unqualifiedAddress(range) {
  if (!range || range.isNullObject) return null;
  return range.address.split("!").pop();
}

export function rangeMetadata(range) {
  if (!range || range.isNullObject) {
    return { address: null, row_count: 0, column_count: 0 };
  }
  return {
    address: unqualifiedAddress(range),
    row_count: range.rowCount,
    column_count: range.columnCount,
  };
}

export function rangeReadProperties(mode, includeNumberFormatCategories) {
  if (!["values", "formulas", "both"].includes(mode)) {
    throw new Error(`Unsupported range read mode: ${mode}`);
  }
  const properties = ["address", "rowCount", "columnCount"];
  if (mode === "values" || mode === "both") {
    properties.push("values");
    if (includeNumberFormatCategories) {
      properties.push("numberFormatCategories");
    }
  }
  if (mode === "formulas" || mode === "both") {
    properties.push("formulas");
  }
  return properties;
}
