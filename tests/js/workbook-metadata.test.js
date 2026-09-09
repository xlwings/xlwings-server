import { describe, expect, it, vi } from "vitest";

import {
  eagerValueRangeAddress,
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
      "numberFormatCategories",
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

  it("adds date categories for values in the list form too", () => {
    expect(rangeReadProperties(["values", "wrap_text"], true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "numberFormatCategories",
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

  it("adds no load properties for the method-resolved keys", () => {
    // current_region, merge_area, merge_cells, table and borders come from
    // method calls or an explicit collection load in getRangeData, not from
    // range.load().
    expect(
      rangeReadProperties(
        ["current_region", "merge_area", "merge_cells", "table", "borders"],
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

  it("rejects strings, empty lists and unknown keys", () => {
    expect(() => rangeReadKeys("both")).toThrow("Unsupported range read mode");
    expect(() => rangeReadKeys([])).toThrow("Unsupported range read mode");
    expect(() => rangeReadKeys(["nope"])).toThrow(
      "Unsupported range read key: nope",
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
  // keyed and valued in the snake_case vocabulary of xlwings.enums.
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
