import { describe, expect, it } from "vitest";

import {
  rangeMetadata,
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
