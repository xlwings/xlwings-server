import { describe, expect, it, vi } from "vitest";

import { createSetFormula } from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";

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
