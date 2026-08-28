import { describe, expect, it } from "vitest";

import {
  rangeMetadata,
  rangeReadKeys,
  rangeReadProperties,
  unqualifiedAddress,
} from "../../xlwings_server/static/js/custom-scripts/workbook-metadata.js";

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
    expect(rangeReadProperties("values", false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
    ]);
    expect(rangeReadProperties("formulas", true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "formulas",
    ]);
    expect(rangeReadProperties("both", true)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "numberFormatCategories",
      "formulas",
    ]);
    expect(rangeReadProperties("both", false)).toEqual([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "formulas",
    ]);
  });

  it("rejects unsupported modes", () => {
    expect(() => rangeReadProperties("everything", false)).toThrow(
      "Unsupported range read mode: everything",
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
  it("expands the legacy string modes", () => {
    expect(rangeReadKeys("values")).toEqual(["values"]);
    expect(rangeReadKeys("formulas")).toEqual(["formulas"]);
    expect(rangeReadKeys("both")).toEqual(["values", "formulas"]);
  });

  it("passes a list of keys through", () => {
    expect(rangeReadKeys(["color", "top"])).toEqual(["color", "top"]);
  });
});
