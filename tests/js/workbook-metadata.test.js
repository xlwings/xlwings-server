import { describe, expect, it, vi } from "vitest";

import {
  eagerValueRangeAddress,
  loadValuesOnlyUsedRange,
  loadWorksheetNotes,
  mergeCellsState,
  normalizeFillColor,
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
    expect(load).toHaveBeenCalledWith("items/content");
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
    // current_region, merge_area, merge_cells and table come from method
    // calls in getRangeData, not from range.load().
    expect(
      rangeReadProperties(
        ["current_region", "merge_area", "merge_cells", "table"],
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
  // Office.js documents both #RRGGBB and named HTML colours for a fill; the
  // Python side's hex_to_rgb() only understands the former.
  const named = (color) => (color === "orange" ? "#ffa500" : "");

  it("passes hex colours through, adding the missing hash", () => {
    expect(normalizeFillColor("#FFA500", named)).toBe("#FFA500");
    expect(normalizeFillColor("FFA500", named)).toBe("#FFA500");
  });

  it("resolves a named colour", () => {
    expect(normalizeFillColor("orange", named)).toBe("#ffa500");
  });

  it("treats an absent or unresolvable colour as no fill", () => {
    expect(normalizeFillColor(null, named)).toBeNull();
    expect(normalizeFillColor("", named)).toBeNull();
    expect(normalizeFillColor("notacolour", named)).toBeNull();
  });
});
