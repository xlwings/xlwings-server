import { describe, expect, it, vi } from "vitest";

import {
  conditionalFormatMetadata,
  convertDateValues,
  eagerValueRangeAddress,
  isDateNumberFormat,
  liveRangeValues,
  loadConditionalFormatDetails,
  loadChartAndPivotMetadata,
  loadValuesOnlyUsedRange,
  loadWorksheetNotes,
  mergeCellsState,
  normalizeBorders,
  normalizeFillColor,
  rangeAddressFromDimensions,
  rangeMetadata,
  rangeReadKeys,
  rangeReadProperties,
  unqualifiedAddress,
} from "../../xlwings_server/static/js/custom-scripts/workbook-metadata.js";

describe("loadValuesOnlyUsedRange", () => {
  it("always requests the values-only Office.js used range", () => {
    const loaded = {};
    const load = vi.fn(() => loaded);
    const getUsedRangeOrNullObject = vi.fn(() => ({ load }));

    expect(loadValuesOnlyUsedRange({ getUsedRangeOrNullObject })).toBe(loaded);
    expect(getUsedRangeOrNullObject).toHaveBeenCalledWith(true);
    expect(load).toHaveBeenCalledWith("address, rowCount, columnCount");
  });
});

describe("eagerValueRangeAddress", () => {
  it("builds the eager values window from the values-only used range", () => {
    const usedRange = {
      address: "Sheet1!B2:C3",
      isNullObject: false,
    };
    expect(eagerValueRangeAddress(usedRange)).toBe("A1:C3");
  });

  it("uses a single cell for a sheet without values", () => {
    expect(eagerValueRangeAddress({ isNullObject: true })).toBe("A1:A1");
  });
});

describe("loadWorksheetNotes", () => {
  it("does not touch the ExcelApi 1.18 property on unsupported hosts", () => {
    const sheet = {};
    Object.defineProperty(sheet, "notes", {
      get: () => {
        throw new Error("unsupported notes property was accessed");
      },
    });
    const isSetSupported = vi.fn(() => false);

    expect(loadWorksheetNotes(sheet, false, isSetSupported)).toBeNull();
    expect(isSetSupported).toHaveBeenCalledWith("ExcelApi", "1.18");
  });

  it("loads notes on supported, included sheets", () => {
    const loaded = {};
    const load = vi.fn(() => loaded);
    const sheet = { notes: { load } };

    expect(loadWorksheetNotes(sheet, false, () => true)).toBe(loaded);
    // Addresses only: a note's text is fetched on demand, so it doesn't ride
    // along in every request.
    expect(load).toHaveBeenCalledWith("items");
  });

  it("skips excluded sheets without checking host support", () => {
    const isSetSupported = vi.fn();
    expect(loadWorksheetNotes({}, true, isSetSupported)).toBeNull();
    expect(isSetSupported).not.toHaveBeenCalled();
  });
});

describe("mergeCellsState", () => {
  const range = { rowIndex: 0, columnIndex: 1, rowCount: 1, columnCount: 2 };

  it("reports false when no cells are merged", () => {
    expect(mergeCellsState(range, [])).toBe(false);
  });

  it("reports true when the requested range is fully covered", () => {
    const area = { rowIndex: 0, columnIndex: 0, rowCount: 1, columnCount: 3 };
    expect(mergeCellsState(range, [area])).toBe(true);
  });

  it("reports null when a merged area only overlaps part of the range", () => {
    // A1:B1 is merged while the requested range is B1:C1. Counting the
    // merged area's full size would incorrectly report true for both.
    const area = { rowIndex: 0, columnIndex: 0, rowCount: 1, columnCount: 2 };
    expect(mergeCellsState(range, [area])).toBeNull();
  });
});

describe("unqualifiedAddress", () => {
  it("removes the sheet qualifier", () => {
    expect(unqualifiedAddress({ address: "'Forecast!2026'!B2:F12" })).toBe(
      "B2:F12",
    );
  });

  it("returns null for an empty or unavailable range", () => {
    expect(unqualifiedAddress({ isNullObject: true })).toBeNull();
    expect(unqualifiedAddress(undefined)).toBeNull();
  });
});

describe("rangeMetadata", () => {
  it("returns an unqualified address and dimensions", () => {
    expect(
      rangeMetadata({
        isNullObject: false,
        address: "'Sales 2026'!B2:F12",
        rowCount: 11,
        columnCount: 5,
      }),
    ).toEqual({ address: "B2:F12", row_count: 11, column_count: 5 });
  });

  it("represents an empty or unavailable range without values", () => {
    expect(rangeMetadata({ isNullObject: true })).toEqual({
      address: null,
      row_count: 0,
      column_count: 0,
    });
    expect(rangeMetadata(undefined)).toEqual({
      address: null,
      row_count: 0,
      column_count: 0,
    });
  });
});

describe("rangeAddressFromDimensions", () => {
  it("constructs a rectangular A1 address from zero-based coordinates", () => {
    expect(rangeAddressFromDimensions(0, 6, 1, 2)).toBe("G1:H1");
    expect(rangeAddressFromDimensions(3, 25, 2, 3)).toBe("Z4:AB5");
  });

  it("uses a single address for a one-cell range", () => {
    expect(rangeAddressFromDimensions(0, 0, 1, 1)).toBe("A1");
  });
});

describe("rangeReadProperties", () => {
  it("loads only the requested cell representation", () => {
    expect(rangeReadProperties(["values"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
    ]);
    expect(rangeReadProperties(["formulas"], true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "formulas",
    ]);
    expect(rangeReadProperties(["values", "formulas"], true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "numberFormat",
      "formulas",
    ]);
    expect(rangeReadProperties(["values", "formulas"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "formulas",
    ]);
  });

  it("rejects a bare string mode", () => {
    // Callers translate their own vocabulary into read keys.
    expect(() => rangeReadProperties("both", false)).toThrow(
      "Unsupported range read mode",
    );
  });

  it("accepts a list of keys and dedupes shared properties", () => {
    expect(rangeReadProperties(["formula_array"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "formulaArray",
    ]);
    expect(rangeReadProperties(["number_format", "color"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "numberFormat",
      "format/fill/color",
    ]);
    // requesting the same key twice doesn't duplicate the property
    expect(rangeReadProperties(["left", "left", "top"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "left",
      "top",
    ]);
  });

  it("adds number formats for values in the list form too", () => {
    expect(rangeReadProperties(["values", "wrap_text"], true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "numberFormat",
      "format/wrapText",
    ]);
    // ...but not when values isn't requested
    expect(rangeReadProperties(["wrap_text"], true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "format/wrapText",
    ]);
  });

  it("loads the format properties for the alignment keys", () => {
    expect(rangeReadProperties(["horizontal_alignment"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "format/horizontalAlignment",
    ]);
    expect(rangeReadProperties(["vertical_alignment"], false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "format/verticalAlignment",
    ]);
    // both axes together, and alongside the neighbouring format key
    expect(
      rangeReadProperties(
        ["wrap_text", "horizontal_alignment", "vertical_alignment"],
        false,
      ),
    ).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "format/wrapText",
      "format/horizontalAlignment",
      "format/verticalAlignment",
    ]);
    // a repeated key doesn't duplicate its property
    expect(
      rangeReadProperties(
        ["horizontal_alignment", "horizontal_alignment"],
        false,
      ),
    ).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "format/horizontalAlignment",
    ]);
  });

  it("adds no load properties for the method-resolved keys", () => {
    // These keys come from method calls or explicit collection loads in
    // getRangeData, not from range.load().
    expect(
      rangeReadProperties(
        [
          "current_region",
          "merge_area",
          "merge_cells",
          "table",
          "borders",
          "conditional_formats",
        ],
        false,
      ),
    ).toEqual(["address", "rowCount", "columnCount"]);
  });

  it("rejects unknown keys and empty lists", () => {
    expect(() => rangeReadProperties(["nonsense"], false)).toThrow(
      "Unsupported range read key: nonsense",
    );
    expect(() => rangeReadProperties([], false)).toThrow(
      "Unsupported range read mode",
    );
  });
});

describe("rangeReadKeys", () => {
  it("passes a list of keys through", () => {
    expect(rangeReadKeys(["color", "top"])).toEqual(["color", "top"]);
  });

  it("accepts the alignment keys", () => {
    expect(rangeReadKeys(["horizontal_alignment"])).toEqual([
      "horizontal_alignment",
    ]);
    expect(rangeReadKeys(["vertical_alignment"])).toEqual([
      "vertical_alignment",
    ]);
    expect(
      rangeReadKeys(["horizontal_alignment", "vertical_alignment"]),
    ).toEqual(["horizontal_alignment", "vertical_alignment"]);
  });

  it("rejects strings, empty lists and unknown keys", () => {
    expect(() => rangeReadKeys("both")).toThrow("Unsupported range read mode");
    expect(() => rangeReadKeys([])).toThrow("Unsupported range read mode");
    expect(() => rangeReadKeys(["nope"])).toThrow(
      "Unsupported range read key: nope",
    );
  });
});

describe("conditionalFormatMetadata", () => {
  it("preserves collection order, native types and stop-if-true state", () => {
    expect(
      conditionalFormatMetadata([
        {
          type: "CellValue",
          stopIfTrue: true,
          cellValue: {
            rule: {
              operator: "LessThan",
              formula1: "60",
              // Excel may retain this inactive value after an operator change.
              formula2: "999",
            },
            format: {
              fill: { color: "#FFFF00" },
              font: { color: null, bold: null, italic: true },
            },
          },
        },
        { type: "DataBar", stopIfTrue: null },
        { type: "PresetCriteria", stopIfTrue: false },
      ]),
    ).toEqual([
      {
        type: "CellValue",
        stop_if_true: true,
        operator: "LessThan",
        formula1: "60",
        formula2: null,
        fill_color: "#ffff00",
        font_color: null,
        font_bold: null,
        font_italic: true,
      },
      { type: "DataBar", stop_if_true: null },
      { type: "PresetCriteria", stop_if_true: false },
    ]);
  });

  it("handles empty collections and missing stop-if-true values", () => {
    expect(conditionalFormatMetadata([])).toEqual([]);
    expect(conditionalFormatMetadata([{ type: "IconSet" }])).toEqual([
      { type: "IconSet", stop_if_true: null },
    ]);
  });

  it("orders loaded rules by their evaluation priority", () => {
    expect(
      conditionalFormatMetadata(
        [
          { type: "PresetCriteria", priority: 2 },
          { type: "ContainsText", priority: 0 },
          { type: "TopBottom", priority: 1 },
        ],
        { sortByPriority: true },
      ).map((rule) => rule.type),
    ).toEqual(["ContainsText", "TopBottom", "PresetCriteria"]);
  });

  it("does not read priority when preserving the supplied order", () => {
    const item = { type: "PresetCriteria" };
    Object.defineProperty(item, "priority", {
      get() {
        throw new Error("priority was not loaded");
      },
    });

    expect(conditionalFormatMetadata([item])).toEqual([
      { type: "PresetCriteria", stop_if_true: null },
    ]);
  });

  it("preserves a second formula only for between operators", () => {
    const metadata = conditionalFormatMetadata([
      {
        type: "CellValue",
        cellValue: {
          rule: {
            operator: "Between",
            formula1: "5",
            formula2: "10",
          },
          format: {
            fill: { color: null },
            font: { color: null, bold: null, italic: null },
          },
        },
      },
    ]);

    expect(metadata[0].formula2).toBe("10");
  });

  it("serializes visual rule details and effective thresholds", () => {
    expect(
      conditionalFormatMetadata([
        {
          type: "ColorScale",
          colorScale: {
            criteria: {
              minimum: { type: "LowestValue", color: "#F8696B" },
              midpoint: {
                type: "Percentile",
                formula: "50",
                color: "#FFEB84",
              },
              maximum: { type: "HighestValue", color: "#63BE7B" },
            },
          },
        },
        {
          type: "DataBar",
          dataBar: {
            lowerBoundRule: { type: "Automatic" },
            upperBoundRule: { type: "Number", formula: "100" },
            positiveFormat: { fillColor: "#638EC6", gradientFill: true },
            showDataBarOnly: false,
          },
        },
        {
          type: "IconSet",
          iconSet: {
            style: "ThreeTrafficLights1",
            showIconOnly: true,
            reverseIconOrder: true,
            criteria: [
              {},
              { type: "Number", formula: "60" },
              { type: "Number", formula: "80" },
            ],
          },
        },
      ]),
    ).toEqual([
      {
        type: "ColorScale",
        stop_if_true: null,
        colors: ["#F8696B", "#FFEB84", "#63BE7B"],
        threshold_types: ["LowestValue", "Percentile", "HighestValue"],
        thresholds: [null, "50", null],
      },
      {
        type: "DataBar",
        stop_if_true: null,
        bar_color: "#638EC6",
        gradient: true,
        show_value: true,
        threshold_types: ["Automatic", "Number"],
        thresholds: [null, "100"],
      },
      {
        type: "IconSet",
        stop_if_true: null,
        icon_set: "ThreeTrafficLights1",
        show_value: false,
        reverse_order: true,
        threshold_types: ["Number", "Number"],
        thresholds: ["60", "80"],
      },
    ]);
  });

  it("loads each visual rule family in one detail pass", () => {
    const colorScale = { load: vi.fn() };
    const dataBar = { load: vi.fn(), positiveFormat: { load: vi.fn() } };
    const iconSet = { load: vi.fn() };

    expect(
      loadConditionalFormatDetails([
        { type: "ColorScale", colorScale },
        { type: "DataBar", dataBar },
        { type: "IconSet", iconSet },
      ]),
    ).toBe(true);
    expect(colorScale.load).toHaveBeenCalledWith("criteria,threeColorScale");
    expect(dataBar.load).toHaveBeenCalledWith(
      "lowerBoundRule,showDataBarOnly,upperBoundRule",
    );
    expect(dataBar.positiveFormat.load).toHaveBeenCalledWith(
      "fillColor,gradientFill",
    );
    expect(iconSet.load).toHaveBeenCalledWith(
      "criteria,reverseIconOrder,showIconOnly,style",
    );
  });
});

describe("normalizeFillColor", () => {
  // Office.js documents both #RRGGBB and named HTML colors for a fill; the
  // Python side's hex_to_rgb() only understands the former.
  const named = (color) => (color === "orange" ? "#ffa500" : "");

  it("passes hex colors through, adding the missing hash", () => {
    expect(normalizeFillColor("#FFA500", named)).toBe("#FFA500");
    expect(normalizeFillColor("FFA500", named)).toBe("#FFA500");
  });

  it("resolves a named color", () => {
    expect(normalizeFillColor("orange", named)).toBe("#ffa500");
  });

  it("treats an absent or unresolvable color as no fill", () => {
    expect(normalizeFillColor(null, named)).toBeNull();
    expect(normalizeFillColor("", named)).toBeNull();
    expect(normalizeFillColor("notacolor", named)).toBeNull();
  });
});

describe("normalizeBorders", () => {
  // What Python's Border.get_*() / Borders.get_*() read: all eight sides,
  // keyed and valued in the snake_case vocabulary of xlwings.base_classes.
  const named = (color) => (color === "orange" ? "#ffa500" : "");
  const SIDES = {
    edge_top: "EdgeTop",
    edge_bottom: "EdgeBottom",
    edge_left: "EdgeLeft",
    edge_right: "EdgeRight",
    inside_vertical: "InsideVertical",
    inside_horizontal: "InsideHorizontal",
    diagonal_down: "DiagonalDown",
    diagonal_up: "DiagonalUp",
  };
  const uniform = (style, weight, color) =>
    Object.values(SIDES).map((sideIndex) => ({
      sideIndex,
      style,
      weight,
      color,
    }));

  it("reports all eight sides in the Python vocabulary", () => {
    const borders = normalizeBorders(
      uniform("Continuous", "Thin", "#FF0000"),
      named,
    );
    expect(Object.keys(borders)).toEqual(Object.keys(SIDES));
    for (const side of Object.keys(SIDES)) {
      expect(borders[side]).toEqual({
        line_style: "continuous",
        weight: "thin",
        color: "#FF0000",
      });
    }
  });

  it.each([
    ["Continuous", "continuous"],
    ["Dash", "dash"],
    ["DashDot", "dash_dot"],
    ["DashDotDot", "dash_dot_dot"],
    ["Dot", "dot"],
    ["Double", "double"],
    ["SlantDashDot", "slant_dash_dot"],
  ])("maps the line style %s to %s", (officeStyle, lineStyle) => {
    const borders = normalizeBorders(uniform(officeStyle, "Thin", "#000000"));
    expect(borders.edge_top.line_style).toBe(lineStyle);
  });

  it.each([
    ["Hairline", "hairline"],
    ["Thin", "thin"],
    ["Medium", "medium"],
    ["Thick", "thick"],
  ])("maps the weight %s to %s", (officeWeight, weight) => {
    const borders = normalizeBorders(
      uniform("Continuous", officeWeight, "#000000"),
    );
    expect(borders.inside_vertical.weight).toBe(weight);
  });

  it("reports a removed border as none without a color", () => {
    const items = uniform("Continuous", "Thin", "#000000");
    items[0].style = "None";
    const borders = normalizeBorders(items, named);
    expect(borders.edge_top).toEqual({
      line_style: "none",
      weight: "thin",
      color: null,
    });
    expect(borders.edge_bottom.color).toBe("#000000");
  });

  it("keeps the sides apart", () => {
    const items = uniform("Continuous", "Thin", "#000000");
    items.find((item) => item.sideIndex === "DiagonalUp").style = "Double";
    items.find((item) => item.sideIndex === "InsideHorizontal").weight =
      "Thick";
    const borders = normalizeBorders(items, named);
    expect(borders.diagonal_up.line_style).toBe("double");
    expect(borders.diagonal_down.line_style).toBe("continuous");
    expect(borders.inside_horizontal.weight).toBe("thick");
    expect(borders.inside_vertical.weight).toBe("thin");
  });

  it("normalizes named and hash-less colors", () => {
    const items = uniform("Continuous", "Thin", "orange");
    items[1].color = "00ff00";
    const borders = normalizeBorders(items, named);
    expect(borders.edge_top.color).toBe("#ffa500");
    expect(borders.edge_bottom.color).toBe("#00ff00");
  });

  it("reports null for empty values", () => {
    // Office.js doesn't leave border values empty for a mixed range (it
    // reports the first segment's), but an empty value still mustn't leak
    // through as "" or throw.
    const items = uniform("", "", "");
    const borders = normalizeBorders(items, named);
    expect(borders.edge_left).toEqual({
      line_style: null,
      weight: null,
      color: null,
    });
    expect(
      normalizeBorders(uniform(null, null, null), named).edge_left,
    ).toEqual({ line_style: null, weight: null, color: null });
  });

  it("tolerates missing items and unknown values", () => {
    const borders = normalizeBorders(
      [
        {
          sideIndex: "EdgeTop",
          style: "Fancy",
          weight: "Bold",
          color: "#000000",
        },
      ],
      named,
    );
    expect(borders.edge_top).toEqual({
      line_style: null,
      weight: null,
      color: "#000000",
    });
    expect(borders.edge_bottom).toEqual({
      line_style: null,
      weight: null,
      color: null,
    });
    expect(Object.keys(normalizeBorders(null, named))).toHaveLength(8);
  });
});

describe("liveRangeValues", () => {
  it("passes a null values result through without touching number formats", () => {
    // Office.js returns null instead of raising on an oversized range get.
    const range = { values: null };
    Object.defineProperty(range, "numberFormat", {
      get: () => {
        throw new Error("unloaded numberFormat was accessed");
      },
    });

    expect(liveRangeValues(range, true)).toBeNull();
    expect(liveRangeValues(range, false)).toBeNull();
  });

  it("converts date and time serials when number formats are available", () => {
    const range = {
      values: [[45000, "x", 0.5]],
      numberFormat: [["m/d/yyyy", "General", "h:mm"]],
    };

    expect(liveRangeValues(range, true)).toEqual([
      ["2023-03-15T00:00:00.000Z", "x", "1899-12-30T12:00:00.000Z"],
    ]);
  });

  it("leaves values untouched when number formats were not loaded", () => {
    const range = { values: [[45000, "x"]] };
    Object.defineProperty(range, "numberFormat", {
      get: () => {
        throw new Error("unloaded numberFormat was accessed");
      },
    });

    expect(liveRangeValues(range, false)).toEqual([[45000, "x"]]);
  });
});

describe("convertDateValues", () => {
  it("only converts numbers with date/time formats, in place", () => {
    const values = [
      [45000, 45000],
      ["45000", null],
    ];
    convertDateValues(values, [
      ["m/d/yyyy", "#,##0.00"],
      ["m/d/yyyy", "h:mm"],
    ]);
    expect(values).toEqual([
      ["2023-03-15T00:00:00.000Z", 45000],
      ["45000", null],
    ]);
  });

  it("converts numbers with custom date and time formats", () => {
    const values = [[45000, 45000.5, 45000]];
    convertDateValues(values, [
      ["yyyy-mm-dd", "dd/mm/yyyy hh:mm:ss", "#,##0.00"],
    ]);

    expect(values).toEqual([
      ["2023-03-15T00:00:00.000Z", "2023-03-15T12:00:00.000Z", 45000],
    ]);
  });
});

describe("isDateNumberFormat", () => {
  it.each([
    "yyyy-mm-dd",
    "dd/mm/yyyy hh:mm:ss",
    "[$-F800]dddd, mmmm dd, yyyy",
    "[$-F400]h:mm:ss AM/PM",
    'm"M"d"D";@',
    '[$-404]e"year"m"month"d"day"',
    "[h]:mm:ss",
    "[Blue]yyyy-mm-dd;[Red]-yyyy-mm-dd",
    "h:mm AM/PM",
  ])("recognizes date/time format %s", (format) => {
    expect(isDateNumberFormat(format)).toBe(true);
  });

  it.each([
    "General",
    "0.00E+00",
    "#,##0.00",
    '0.00 "days"',
    "#,#0 \\d",
    "[$-409]#,##0.00",
    "[Red]0.00",
    "#,##0*y",
  ])("rejects non-date format %s", (format) => {
    expect(isDateNumberFormat(format)).toBe(false);
  });
});

describe("loadChartAndPivotMetadata", () => {
  const collection = (items) => ({
    items,
    load: vi.fn(function () {
      return this;
    }),
  });
  const pivot = () => ({
    id: "pivot-1",
    name: "ExistingReport",
    hierarchies: collection([{ name: "Region" }, { name: "Sales" }]),
    rowHierarchies: collection([{ name: "Region" }]),
    columnHierarchies: collection([]),
    filterHierarchies: collection([]),
    dataHierarchies: collection([
      {
        id: "value-1",
        name: "Sum of Sales",
        field: { name: "Sales" },
        summarizeBy: "Sum",
        numberFormat: "0.00",
      },
    ]),
    layout: {
      layoutType: "Compact",
      showRowGrandTotals: true,
      showColumnGrandTotals: true,
    },
  });

  it("reports only source fields in the areas, not the Values pseudo hierarchy", async () => {
    // Excel lists a localized "Values" hierarchy in the columns (or rows) area
    // once a pivot has value fields; it isn't in `hierarchies`.
    const withValues = pivot();
    withValues.columnHierarchies = collection([
      { name: "Werte" },
      { name: "Sales" },
    ]);
    withValues.rowHierarchies = collection([{ name: "Region" }]);
    const sheet = {
      pivotTables: collection([withValues]),
      charts: collection([]),
    };
    const context = { sync: vi.fn(async () => {}) };
    const metadata = await loadChartAndPivotMetadata(
      context,
      sheet,
      false,
      true,
    );
    expect(metadata.pivot_tables[0].field_names).toEqual(["Region", "Sales"]);
    expect(metadata.pivot_tables[0].rows).toEqual(["Region"]);
    expect(metadata.pivot_tables[0].columns).toEqual(["Sales"]);
  });

  it("keeps pivots and their IDs on excluded sheets without loading charts", async () => {
    const sheet = {
      pivotTables: collection([pivot()]),
      get charts() {
        throw new Error("excluded charts accessed");
      },
    };
    const context = { sync: vi.fn(async () => {}) };
    const metadata = await loadChartAndPivotMetadata(
      context,
      sheet,
      true,
      true,
    );
    expect(metadata.charts).toEqual([]);
    expect(metadata.pivot_tables).toEqual([
      {
        id: "pivot-1",
        name: "ExistingReport",
        field_names: ["Region", "Sales"],
        rows: ["Region"],
        columns: [],
        filters: [],
        values: [
          {
            id: "value-1",
            name: "Sum of Sales",
            source_field: "Sales",
            function: "Sum",
            number_format: "0.00",
          },
        ],
        layout: "Compact",
        show_row_grand_totals: true,
        show_column_grand_totals: true,
      },
    ]);
    // A newly created pivot must be appended after the existing report.
    expect(metadata.pivot_tables.length).toBe(1);
    expect(sheet.pivotTables.load.mock.calls[0][0]).toContain("items/id");
    expect(sheet.pivotTables.load.mock.calls[0][0]).toContain(
      "items/dataHierarchies/items/id",
    );
    expect(context.sync).toHaveBeenCalledTimes(1);
  });

  it("loads included charts and pivots in a single sync", async () => {
    const chart = {
      name: "Chart",
      chartType: "ColumnClustered",
      left: 1,
      top: 2,
      width: 3,
      height: 4,
    };
    const sheet = {
      charts: collection([chart]),
      pivotTables: collection([pivot()]),
    };
    const context = { sync: vi.fn(async () => {}) };
    const metadata = await loadChartAndPivotMetadata(
      context,
      sheet,
      false,
      true,
    );
    expect(metadata.charts).toEqual([
      {
        name: "Chart",
        chart_type: "ColumnClustered",
        left: 1,
        top: 2,
        width: 3,
        height: 4,
      },
    ]);
    expect(metadata.pivot_tables[0].id).toBe("pivot-1");
    expect(context.sync).toHaveBeenCalledTimes(1);
  });

  it("distinguishes unsupported hosts from empty collections", async () => {
    const sheet = {
      get pivotTables() {
        throw new Error("unsupported pivots accessed");
      },
      get charts() {
        throw new Error("excluded charts accessed");
      },
    };
    const context = { sync: vi.fn(async () => {}) };
    expect(
      await loadChartAndPivotMetadata(context, sheet, true, false),
    ).toEqual({ charts: [], pivot_tables: null });
    expect(context.sync).not.toHaveBeenCalled();
    expect(
      await loadChartAndPivotMetadata(
        context,
        { pivotTables: collection([]) },
        true,
        true,
      ),
    ).toEqual({ charts: [], pivot_tables: [] });
  });
});
