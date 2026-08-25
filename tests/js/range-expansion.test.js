import { describe, expect, it } from "vitest";

import { unsupportedRangeExpansion } from "../../xlwings_server/static/js/custom-scripts/range-expansion.js";

describe("unsupportedRangeExpansion", () => {
  it("preserves the existing Python fallback", () => {
    expect(unsupportedRangeExpansion("A3", false)).toBe("A3");
  });

  it("fails closed for Wingman contiguous reads", () => {
    expect(() => unsupportedRangeExpansion("A3", true)).toThrowError(
      expect.objectContaining({
        code: "range_expansion_unavailable",
        message: "Contiguous range expansion requires ExcelApi 1.13 or newer",
      }),
    );
  });
});
