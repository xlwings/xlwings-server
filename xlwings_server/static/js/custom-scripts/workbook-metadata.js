export function unqualifiedAddress(range) {
  if (!range || range.isNullObject) return null;
  return range.address.split("!").pop();
}

export function convertDateValues(values, categories) {
  values.forEach((row, ri) => {
    const catRow = categories[ri];
    row.forEach((val, ci) => {
      const cat = catRow[ci].toString();
      if ((cat === "Date" || cat === "Time") && typeof val === "number") {
        values[ri][ci] = new Date(
          Math.round((val - 25569) * 86400 * 1000),
        ).toISOString();
      }
    });
  });
}

// Values of a live (on-demand) range read. Office.js may return null instead of
// raising when a range get exceeds its 5,000,000-cell limit; pass that through
// untouched so Python can raise a diagnostic (convertDateValues would throw on
// null first). numberFormatCategories is only touched when it was loaded.
export function liveRangeValues(range, hasDateCategories) {
  const values = range.values;
  if (values == null) return null;
  if (hasDateCategories) {
    convertDateValues(values, range.numberFormatCategories);
  }
  return values;
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
// xlwings.base_classes) against the Office.js BorderIndex / BorderLineStyle /
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
// line_style ("none" for no border), weight and color. Unlike the desktop
// engines, Office.js doesn't flag a side whose segments differ from cell to
// cell: an edge reports its first segment's value, and an inside border reads
// "None" once the range's cells don't share the same border formatting, even
// though every cell's own borders are intact (measured on Excel for Mac,
// 2026-09-07). An empty, absent or unknown value still becomes null, like
// every other read. A removed border has no color, so that's null too.
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

// Office.js allows named HTML colors for a fill ("orange"); xlwings expects
// #RRGGBB. Resolving a name needs a DOM round-trip, which only happens when a
// color is actually read and isn't already hex.
export function normalizeFillColor(color, resolveNamedColor = canvasColor) {
  if (!color) return null;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
  const resolved = resolveNamedColor(color);
  return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : null;
}

// Named-color resolution is the one part that needs a DOM, so it's injected
// above rather than reached for directly -- that keeps normalizeFillColor
// testable without pulling jsdom into this package.
function canvasColor(color) {
  const context = document.createElement("canvas").getContext("2d");
  context.fillStyle = "#000000";
  context.fillStyle = color;
  return context.fillStyle;
}

// Exclusion controls the cell/chart snapshot, but a pivot collection must
// stay complete so writes never address an existing pivot as a newly added one.
export async function loadChartAndPivotMetadata(
  context,
  sheet,
  excluded,
  pivotTablesSupported,
) {
  const charts = excluded
    ? null
    : sheet.charts.load([
        "name",
        "chartType",
        "left",
        "top",
        "width",
        "height",
      ]);
  const pivots = pivotTablesSupported
    ? sheet.pivotTables.load(PIVOT_TABLE_LOAD_PATHS)
    : null;
  if (charts || pivots) await context.sync();
  return {
    charts: charts
      ? charts.items.map((chart) => ({
          name: chart.name,
          chart_type: chart.chartType,
          left: chart.left,
          top: chart.top,
          width: chart.width,
          height: chart.height,
        }))
      : [],
    pivot_tables: pivots ? pivots.items.map(pivotTableMetadata) : null,
  };
}

// Everything the payload reports about a pivot table, loaded with a single
// path-expansion load on the sheet's pivotTables collection. Names only for
// the hierarchies: the source field of a value hierarchy needs a hop through
// `field`, since its own name is the caption ("Sum of Sales").
const PIVOT_TABLE_LOAD_PATHS = [
  "items/id",
  "items/name",
  "items/hierarchies/items/name",
  "items/rowHierarchies/items/name",
  "items/columnHierarchies/items/name",
  "items/filterHierarchies/items/name",
  "items/dataHierarchies/items/id",
  "items/dataHierarchies/items/name",
  "items/dataHierarchies/items/summarizeBy",
  "items/dataHierarchies/items/numberFormat",
  "items/dataHierarchies/items/field/name",
  "items/layout/layoutType",
  "items/layout/showRowGrandTotals",
  "items/layout/showColumnGrandTotals",
].join(",");

function hierarchyNames(collection) {
  return collection.items.map((hierarchy) => hierarchy.name);
}

function pivotTableMetadata(pivotTable) {
  return {
    id: pivotTable.id,
    name: pivotTable.name,
    field_names: hierarchyNames(pivotTable.hierarchies),
    rows: hierarchyNames(pivotTable.rowHierarchies),
    columns: hierarchyNames(pivotTable.columnHierarchies),
    filters: hierarchyNames(pivotTable.filterHierarchies),
    values: pivotTable.dataHierarchies.items.map((hierarchy) => ({
      id: hierarchy.id,
      name: hierarchy.name,
      source_field: hierarchy.field.name,
      // The raw Excel.AggregationFunction string; Python maps it.
      function: hierarchy.summarizeBy,
      number_format: hierarchy.numberFormat,
    })),
    // Office.js reports null for a layout it can't describe.
    layout: pivotTable.layout.layoutType ?? null,
    show_row_grand_totals: pivotTable.layout.showRowGrandTotals,
    show_column_grand_totals: pivotTable.layout.showColumnGrandTotals,
  };
}
