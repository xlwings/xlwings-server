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

// Each key a caller can request maps to the Office.js Range properties that
// have to be loaded for it. Several keys share properties (the format ones in
// particular), so the result is deduped and ordered by first appearance.
const RANGE_READ_KEYS = {
  values: ["values"],
  formulas: ["formulas"],
  formula_array: ["formulaArray"],
  number_format: ["numberFormat"],
  color: ["format/fill/color"],
  wrap_text: ["format/wrapText"],
  column_width: ["format/columnWidth"],
  row_height: ["format/rowHeight"],
  left: ["left"],
  top: ["top"],
  width: ["width"],
  height: ["height"],
};

// Legacy single-string modes, kept so existing callers (and the Wingman
// workbook tool's public contract) keep working alongside the list form.
const LEGACY_MODES = {
  values: ["values"],
  formulas: ["formulas"],
  both: ["values", "formulas"],
};

export function rangeReadKeys(mode) {
  if (typeof mode === "string") {
    const keys = LEGACY_MODES[mode];
    if (!keys) {
      throw new Error(`Unsupported range read mode: ${mode}`);
    }
    return keys;
  }
  if (!Array.isArray(mode) || mode.length === 0) {
    throw new Error(`Unsupported range read mode: ${JSON.stringify(mode)}`);
  }
  for (const key of mode) {
    if (!Object.prototype.hasOwnProperty.call(RANGE_READ_KEYS, key)) {
      throw new Error(`Unsupported range read key: ${key}`);
    }
  }
  return mode;
}

export function rangeReadProperties(mode, includeNumberFormatCategories) {
  const keys = rangeReadKeys(mode);
  const properties = ["address", "rowCount", "columnCount"];
  for (const key of keys) {
    for (const property of RANGE_READ_KEYS[key]) {
      if (!properties.includes(property)) {
        properties.push(property);
      }
    }
    // Dates come back as serial numbers without their category, so this rides
    // along with values only.
    if (key === "values" && includeNumberFormatCategories) {
      const category = "numberFormatCategories";
      if (!properties.includes(category)) {
        properties.push(category);
      }
    }
  }
  return properties;
}
