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
  // Resolved through method calls in getRangeData rather than range.load(),
  // so they contribute no properties here.
  // One key for the whole font: the five attributes come from a single
  // Office.js object, so fetching them together costs no more than one.
  font: [
    "format/font/bold",
    "format/font/italic",
    "format/font/size",
    "format/font/color",
    "format/font/name",
  ],
  hyperlink: ["hyperlink"],
  current_region: [],
  merge_area: [],
  merge_cells: [],
  table: [],
};

export function rangeReadKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error(`Unsupported range read mode: ${JSON.stringify(keys)}`);
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(RANGE_READ_KEYS, key)) {
      throw new Error(`Unsupported range read key: ${key}`);
    }
  }
  return keys;
}

export function rangeReadProperties(keys, includeNumberFormatCategories) {
  const readKeys = rangeReadKeys(keys);
  const properties = ["address", "rowCount", "columnCount"];
  for (const key of readKeys) {
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

// Office.js allows named HTML colours for a fill ("orange"); xlwings expects
// #RRGGBB. Resolving a name needs a DOM round-trip, which only happens when a
// colour is actually read and isn't already hex.
export function normalizeFillColor(color, resolveNamedColor = canvasColor) {
  if (!color) return null;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
  const resolved = resolveNamedColor(color);
  return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : null;
}

// Named-colour resolution is the one part that needs a DOM, so it's injected
// above rather than reached for directly -- that keeps normalizeFillColor
// testable without pulling jsdom into this package.
function canvasColor(color) {
  const context = document.createElement("canvas").getContext("2d");
  context.fillStyle = "#000000";
  context.fillStyle = color;
  return context.fillStyle;
}
