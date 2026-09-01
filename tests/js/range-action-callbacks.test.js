import { describe, expect, it, vi } from "vitest";

import {
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
  function harness() {
    const format = {};
    const range = { format };
    return {
      range,
      format,
      getRange: vi.fn(async () => range),
      context: { sync: vi.fn(async () => {}) },
    };
  }

  it("writes the width straight through as points", async () => {
    // Office.js' RangeFormat.columnWidth is points, and that's the raw
    // measure xlwings passes on this engine -- no unit conversion either way.
    const { format, getRange, context } = harness();
    const setColumnWidth = createSetColumnWidth(getRange);

    await setColumnWidth(context, { args: [110.5] });

    expect(format.columnWidth).toBe(110.5);
    expect(context.sync).toHaveBeenCalled();
  });

  it("preserves zero, which hides the column", async () => {
    const { format, getRange, context } = harness();
    await createSetColumnWidth(getRange)(context, { args: [0] });
    expect(format.columnWidth).toBe(0);
  });

  it("rejects invalid widths before touching the range", async () => {
    for (const value of [-1, NaN, Infinity, null, "wide"]) {
      const { format, getRange, context } = harness();
      await expect(
        createSetColumnWidth(getRange)(context, { args: [value] }),
      ).rejects.toThrow("column_width must be a non-negative number.");
      expect(getRange).not.toHaveBeenCalled();
      expect(format.columnWidth).toBeUndefined();
    }
  });
});
