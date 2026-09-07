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

export function rangeAddressFromDimensions(
  rowIndex,
  columnIndex,
  rowCount,
  columnCount,
) {
  function columnName(index) {
    let name = "";
    for (
      let number = index + 1;
      number > 0;
      number = Math.floor((number - 1) / 26)
    ) {
      name = String.fromCharCode(65 + ((number - 1) % 26)) + name;
    }
    return name;
  }

  const first = `${columnName(columnIndex)}${rowIndex + 1}`;
  if (rowCount === 1 && columnCount === 1) return first;
  const last = `${columnName(columnIndex + columnCount - 1)}${
    rowIndex + rowCount
  }`;
  return `${first}:${last}`;
}

export function loadValuesOnlyUsedRange(sheet) {
  return sheet
    .getUsedRangeOrNullObject(true)
    .load("address, rowCount, columnCount");
}

export function eagerValueRangeAddress(usedRange) {
  const lastCellAddress =
    !usedRange || usedRange.isNullObject
      ? "A1"
      : unqualifiedAddress(usedRange).split(":").pop();
  return `A1:${lastCellAddress}`;
}

export function loadWorksheetNotes(sheet, excluded, isSetSupported) {
  if (excluded || !isSetSupported("ExcelApi", "1.18")) return null;
  // Deliberately not "items/content": Range.note only needs to know which
  // cells have a note, and a note's text can be arbitrarily long. Sending it
  // would put every note's full text in every request. Note.get_text()
  // fetches it on demand instead.
  return sheet.notes.load("items");
}

export function mergeCellsState(range, mergedAreas) {
  const rangeBottom = range.rowIndex + range.rowCount;
  const rangeRight = range.columnIndex + range.columnCount;
  const mergedCellCount = mergedAreas.reduce((total, area) => {
    const overlapRows = Math.max(
      0,
      Math.min(rangeBottom, area.rowIndex + area.rowCount) -
        Math.max(range.rowIndex, area.rowIndex),
    );
    const overlapColumns = Math.max(
      0,
      Math.min(rangeRight, area.columnIndex + area.columnCount) -
        Math.max(range.columnIndex, area.columnIndex),
    );
    return total + overlapRows * overlapColumns;
  }, 0);

  if (mergedCellCount === 0) return false;
  return mergedCellCount === range.rowCount * range.columnCount ? true : null;
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
  // format.borders is a collection, which range.load() can't express as a
  // property path, so getRangeData loads it explicitly. One key for all eight
  // sides: they come from one collection, so fetching them together costs no
  // more than one.
  borders: [],
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

// The border vocabulary the Python side uses (snake_case, see
// xlwings.enums) against the Office.js BorderIndex / BorderLineStyle /
// BorderWeight strings. Python only ever sends and expects the left-hand side.
export const BORDER_SIDES = {
  edge_top: "EdgeTop",
  edge_bottom: "EdgeBottom",
  edge_left: "EdgeLeft",
  edge_right: "EdgeRight",
  inside_vertical: "InsideVertical",
  inside_horizontal: "InsideHorizontal",
  diagonal_down: "DiagonalDown",
  diagonal_up: "DiagonalUp",
};
export const BORDER_LINE_STYLES = {
  continuous: "Continuous",
  dash: "Dash",
  dash_dot: "DashDot",
  dash_dot_dot: "DashDotDot",
  dot: "Dot",
  double: "Double",
  slant_dash_dot: "SlantDashDot",
  none: "None",
};
export const BORDER_WEIGHTS = {
  hairline: "Hairline",
  thin: "Thin",
  medium: "Medium",
  thick: "Thick",
};

function invert(mapping) {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [value, key]),
  );
}
const BORDER_LINE_STYLES_FROM_OFFICE = invert(BORDER_LINE_STYLES);
const BORDER_WEIGHTS_FROM_OFFICE = invert(BORDER_WEIGHTS);

// Turns the loaded items of a RangeBorderCollection into the payload the
// Python side reads: all eight sides keyed by their snake_case name, each with
// line_style ("none" for no border), weight and color. Office.js reports an
// empty or absent value when the range's cells don't agree, which becomes null,
// like every other read. A removed border has no colour, so that's null too.
export function normalizeBorders(items, resolveNamedColor = canvasColor) {
  const bySide = new Map((items || []).map((item) => [item.sideIndex, item]));
  const borders = {};
  for (const [side, index] of Object.entries(BORDER_SIDES)) {
    const item = bySide.get(index);
    const lineStyle = item?.style
      ? (BORDER_LINE_STYLES_FROM_OFFICE[item.style] ?? null)
      : null;
    borders[side] = {
      line_style: lineStyle,
      weight: item?.weight
        ? (BORDER_WEIGHTS_FROM_OFFICE[item.weight] ?? null)
        : null,
      color:
        lineStyle === "none" || !item
          ? null
          : normalizeFillColor(item.color, resolveNamedColor),
    };
  }
  return borders;
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
