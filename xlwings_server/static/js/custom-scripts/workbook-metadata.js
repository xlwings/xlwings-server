export function unqualifiedAddress(range) {
  if (!range || range.isNullObject) return null;
  return range.address.split("!").pop();
}

// Excel reports user-defined date/time formats as "Custom" instead of "Date"
// or "Time". Inspect the actual format code while ignoring literal text and
// other constructs whose letters must not be mistaken for date/time tokens.
export function isDateNumberFormat(format) {
  if (typeof format !== "string") return false;

  for (let i = 0; i < format.length; ) {
    const char = format[i];

    // Quoted text is literal. Excel represents a literal quote inside it as
    // two consecutive quotes.
    if (char === '"') {
      i += 1;
      while (i < format.length) {
        if (format[i] !== '"') {
          i += 1;
        } else if (format[i + 1] === '"') {
          i += 2;
        } else {
          i += 1;
          break;
        }
      }
      continue;
    }

    // Backslash escapes, spacing (_), and fill (*) all make the following
    // character literal.
    if (char === "\\" || char === "_" || char === "*") {
      i += 2;
      continue;
    }

    // Brackets normally hold colors, conditions, currencies, or locales.
    // The exception is an elapsed-time token such as [h], [mm], or [ss].
    if (char === "[") {
      const end = format.indexOf("]", i + 1);
      if (end === -1) return false;
      if (/^(?:h+|m+|s+)$/i.test(format.slice(i + 1, end))) return true;
      i = end + 1;
      continue;
    }

    if (format.slice(i, i + 7).toLowerCase() === "general") {
      i += 7;
      continue;
    }

    // Consume number placeholders as one unit. This prevents the E in a
    // scientific format such as 0.00E+00 from being read as an era token.
    if ("0#?.".includes(char)) {
      i += 1;
      while (i < format.length && "0#?.,Ee+-%".includes(format[i])) i += 1;
      continue;
    }

    if (
      "ymdhseg".includes(char.toLowerCase()) ||
      /^b[12]/i.test(format.slice(i)) ||
      /^(?:a\/p|am\/pm)/i.test(format.slice(i)) ||
      format.startsWith("上午/下午", i)
    ) {
      return true;
    }

    i += 1;
  }
  return false;
}

export function convertDateValues(values, numberFormats) {
  values.forEach((row, ri) => {
    row.forEach((val, ci) => {
      if (
        typeof val === "number" &&
        isDateNumberFormat(numberFormats?.[ri]?.[ci])
      ) {
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
// null first). Number formats are only touched when they were loaded.
export function liveRangeValues(range, hasNumberFormats) {
  const values = range.values;
  if (values == null) return null;
  if (hasNumberFormats) {
    convertDateValues(values, range.numberFormat);
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

export function conditionalFormatMetadata(items) {
  return (items || []).map((item) => {
    const metadata = {
      type: item.type,
      // Office.js reports null for rule families that don't have StopIfTrue.
      stop_if_true: item.stopIfTrue ?? null,
    };
    let detail;
    if (item.type === "CellValue") {
      detail = item.cellValue;
      const usesFormula2 = ["Between", "NotBetween"].includes(
        detail.rule.operator,
      );
      Object.assign(metadata, {
        operator: detail.rule.operator,
        formula1: detail.rule.formula1,
        // Excel may retain an inactive second formula after switching away
        // from a between operator. Keep the public model semantic.
        formula2: usesFormula2 ? (detail.rule.formula2 ?? null) : null,
      });
    } else if (item.type === "Custom") {
      detail = item.custom;
      metadata.formula = detail.rule.formula;
    } else if (item.type === "ColorScale" && item.colorScale) {
      const criteria = item.colorScale.criteria;
      const points = [criteria.minimum];
      if (criteria.midpoint) points.push(criteria.midpoint);
      points.push(criteria.maximum);
      Object.assign(metadata, {
        colors: points.map((point) => normalizeFillColor(point.color)),
        threshold_types: points.map((point) => point.type),
        thresholds: points.map((point) => point.formula ?? null),
      });
    } else if (item.type === "DataBar" && item.dataBar) {
      detail = item.dataBar;
      Object.assign(metadata, {
        bar_color: normalizeFillColor(detail.positiveFormat.fillColor),
        gradient: detail.positiveFormat.gradientFill,
        show_value: !detail.showDataBarOnly,
        threshold_types: [
          detail.lowerBoundRule.type,
          detail.upperBoundRule.type,
        ],
        thresholds: [
          detail.lowerBoundRule.formula ?? null,
          detail.upperBoundRule.formula ?? null,
        ],
      });
      detail = null;
    } else if (item.type === "IconSet" && item.iconSet) {
      detail = item.iconSet;
      const thresholds = detail.criteria.slice(1);
      Object.assign(metadata, {
        icon_set: detail.style,
        show_value: !detail.showIconOnly,
        reverse_order: detail.reverseIconOrder,
        threshold_types: thresholds.map((criterion) => criterion.type),
        thresholds: thresholds.map((criterion) => criterion.formula ?? null),
      });
      detail = null;
    }
    if (detail) {
      Object.assign(metadata, {
        fill_color: detail.format.fill.color?.toLowerCase() ?? null,
        font_color: detail.format.font.color?.toLowerCase() ?? null,
        font_bold: detail.format.font.bold ?? null,
        font_italic: detail.format.font.italic ?? null,
      });
    }
    return metadata;
  });
}

export function loadConditionalFormatDetails(items) {
  let loaded = false;
  for (const item of items || []) {
    let detail;
    if (item.type === "CellValue") {
      detail = item.cellValue;
      detail.load("rule");
    } else if (item.type === "Custom") {
      detail = item.custom;
      detail.rule.load("formula");
    } else if (item.type === "ColorScale" && item.colorScale) {
      item.colorScale.load("criteria,threeColorScale");
      loaded = true;
    } else if (item.type === "DataBar" && item.dataBar) {
      item.dataBar.load("lowerBoundRule,showDataBarOnly,upperBoundRule");
      item.dataBar.positiveFormat.load("fillColor,gradientFill");
      loaded = true;
    } else if (item.type === "IconSet" && item.iconSet) {
      item.iconSet.load("criteria,reverseIconOrder,showIconOnly,style");
      loaded = true;
    }
    if (detail) {
      detail.format.fill.load("color");
      detail.format.font.load("color,bold,italic");
      loaded = true;
    }
  }
  return loaded;
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
  horizontal_alignment: ["format/horizontalAlignment"],
  vertical_alignment: ["format/verticalAlignment"],
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
  conditional_formats: [],
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

export function rangeReadProperties(keys, includeNumberFormats) {
  const readKeys = rangeReadKeys(keys);
  const properties = ["address", "rowCount", "columnCount"];
  for (const key of readKeys) {
    for (const property of RANGE_READ_KEYS[key]) {
      if (!properties.includes(property)) {
        properties.push(property);
      }
    }
    // Dates come back as serial numbers, so the format code rides along with
    // values to identify which numbers need conversion.
    if (key === "values" && includeNumberFormats) {
      if (!properties.includes("numberFormat")) {
        properties.push("numberFormat");
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
// path-expansion load on the sheet's pivotTables collection. A data hierarchy's
// `name` is its displayed caption (e.g., "Sum of Sales"). Read
// `field.name` to get the source field (e.g., "Sales").
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
  // The areas can hold Excel's "Values" pseudo hierarchy (localized name),
  // which isn't a source field: only report what `hierarchies` lists, like
  // the desktop engines do.
  const fieldNames = hierarchyNames(pivotTable.hierarchies);
  const sourceFieldsOnly = (collection) =>
    hierarchyNames(collection).filter((name) => fieldNames.includes(name));
  return {
    id: pivotTable.id,
    name: pivotTable.name,
    field_names: fieldNames,
    rows: sourceFieldsOnly(pivotTable.rowHierarchies),
    columns: sourceFieldsOnly(pivotTable.columnHierarchies),
    filters: sourceFieldsOnly(pivotTable.filterHierarchies),
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
