import { describe, expect, it, vi } from "vitest";

import {
  columnWidthCharactersToPoints,
  createSetColumnWidth,
  createSetFormula,
  createSetFormulaArray,
} from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";

describe("setFormula action callback", () => {
  it("writes the formula matrix and synchronizes the request context", async () => {
    const range = {};
    const context = { sync: vi.fn(async () => {}) };
    const getRange = vi.fn(async () => range);
    const setFormula = createSetFormula(getRange);
    const action = { values: [["=SUM(A1:A2)"]] };

    await setFormula(context, action);

    expect(getRange).toHaveBeenCalledWith(context, action);
    expect(range.formulas).toEqual([["=SUM(A1:A2)"]]);
    expect(context.sync).toHaveBeenCalledOnce();
  });
});

describe("setFormulaArray action callback", () => {
  it("writes a CSE formula to the full target range on supported hosts", async () => {
    const range = {};
    const context = { sync: vi.fn(async () => {}) };
    const getRange = vi.fn(async () => range);
    const setFormulaArray = createSetFormulaArray(getRange, () => true);
    const action = { args: ["=SUM(A1:A3*B1:B3)"] };

    await setFormulaArray(context, action);

    expect(range.formulaArray).toBe("=SUM(A1:A3*B1:B3)");
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it("rejects hosts without the desktop array-formula API", async () => {
    const getRange = vi.fn();
    const setFormulaArray = createSetFormulaArray(getRange, () => false);

    await expect(
      setFormulaArray({ sync: vi.fn() }, { args: ["=SUM(A1:A3)"] }),
    ).rejects.toThrow("ExcelApiDesktop 1.1");
    expect(getRange).not.toHaveBeenCalled();
  });
});

describe("setColumnWidth action callback", () => {
  it("converts character units using the worksheet's standard width", async () => {
    const format = {
      columnWidth: 48,
      load: vi.fn(),
      useStandardWidth: false,
    };
    const sheet = { load: vi.fn(), standardWidth: 8.43 };
    const range = { format, worksheet: sheet };
    const context = { sync: vi.fn(async () => {}) };
    const action = { args: [12] };
    const setColumnWidth = createSetColumnWidth(vi.fn(async () => range));

    await setColumnWidth(context, action);

    expect(format.useStandardWidth).toBe(true);
    expect(format.load).toHaveBeenCalledWith("columnWidth");
    expect(sheet.load).toHaveBeenCalledWith("standardWidth");
    expect(format.columnWidth).toBeCloseTo(66.73, 1);
    expect(context.sync).toHaveBeenCalledTimes(2);
  });

  it("preserves zero as a hidden column width", () => {
    expect(columnWidthCharactersToPoints(0, 8.43, 48)).toBe(0);
  });

  it.each([-1, 256, Number.NaN, "12", true])(
    "rejects invalid widths",
    (value) => {
      expect(() => columnWidthCharactersToPoints(value, 8.43, 48)).toThrow(
        "between 0 and 255",
      );
    },
  );

  it("rejects an invalid action before changing the range", async () => {
    const getRange = vi.fn();
    const setColumnWidth = createSetColumnWidth(getRange);

    await expect(
      setColumnWidth({ sync: vi.fn() }, { args: ["12"] }),
    ).rejects.toThrow("between 0 and 255");
    expect(getRange).not.toHaveBeenCalled();
  });
});
