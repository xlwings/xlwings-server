import { describe, expect, it, vi } from "vitest";

import {
  createApplyAutoFilterRange,
  createApplyAutoFilterTable,
  createClearAutoFilterRange,
  createClearAutoFilterTable,
} from "../../xlwings_server/static/js/custom-scripts/autofilter-action-callbacks.js";
import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";

function rangeHarness({
  existingAddress = null,
  targetAddress = "Sheet1!$A$1:$C$8",
} = {}) {
  const filteredRange = {
    isNullObject: existingAddress === null,
    address: existingAddress,
    load: vi.fn(),
  };
  const autoFilter = {
    apply: vi.fn(),
    clearColumnCriteria: vi.fn(),
    getRangeOrNullObject: vi.fn(() => filteredRange),
  };
  const range = { address: targetAddress, load: vi.fn() };
  const sheet = { autoFilter };
  return {
    autoFilter,
    filteredRange,
    range,
    sheet,
    getRange: vi.fn(async () => range),
    getSheet: vi.fn(async () => sheet),
    context: { sync: vi.fn(async () => {}) },
    supported: vi.fn(() => true),
  };
}

function tableHarness() {
  const filters = Array.from({ length: 3 }, () => ({
    applyValuesFilter: vi.fn(),
    applyCustomFilter: vi.fn(),
    clear: vi.fn(),
  }));
  const table = {
    columns: { getItemAt: vi.fn((index) => ({ filter: filters[index] })) },
  };
  return {
    filters,
    table,
    getTable: vi.fn(async () => table),
    context: { sync: vi.fn(async () => {}) },
    supported: vi.fn(() => true),
  };
}

describe("range AutoFilter action callbacks", () => {
  it("applies an exact values filter to a one-based field", async () => {
    const h = rangeHarness();
    const callback = createApplyAutoFilterRange(
      h.getRange,
      h.getSheet,
      h.supported,
    );
    const action = {
      args: [2, { type: "values", values: ["East", "West"] }],
      column_count: 3,
    };

    await callback(h.context, action);

    expect(h.autoFilter.apply).toHaveBeenCalledWith(h.range, 1, {
      filterOn: "Values",
      values: ["East", "West"],
    });
    expect(h.supported).toHaveBeenCalledWith("ExcelApi", "1.14");
  });

  it.each([
    ["equal_to", null, undefined, { filterOn: "Custom", criterion1: "=" }],
    ["not_equal_to", null, undefined, { filterOn: "Custom", criterion1: "<>" }],
    [
      "between",
      "10",
      "20",
      {
        filterOn: "Custom",
        criterion1: ">=10",
        criterion2: "<=20",
        operator: "And",
      },
    ],
    [
      "not_between",
      "a*",
      "z?",
      {
        filterOn: "Custom",
        criterion1: "<a~*",
        criterion2: ">z~?",
        operator: "Or",
      },
    ],
  ])(
    "maps %s comparison criteria",
    async (operator, value1, value2, expected) => {
      const h = rangeHarness();
      const callback = createApplyAutoFilterRange(
        h.getRange,
        h.getSheet,
        h.supported,
      );
      await callback(h.context, {
        args: [1, { type: "comparison", operator, value1, value2 }],
        column_count: 3,
      });
      expect(h.autoFilter.apply).toHaveBeenCalledWith(h.range, 0, expected);
    },
  );

  it("refuses to replace an AutoFilter on a different range", async () => {
    const h = rangeHarness({ existingAddress: "Sheet1!$E$1:$G$8" });
    const callback = createApplyAutoFilterRange(
      h.getRange,
      h.getSheet,
      h.supported,
    );
    await expect(
      callback(h.context, {
        args: [1, { type: "values", values: ["East"] }],
        column_count: 3,
      }),
    ).rejects.toThrow("different range");
    expect(h.autoFilter.apply).not.toHaveBeenCalled();
  });

  it("clears one field and all fields without clearing sort state", async () => {
    const h = rangeHarness({ existingAddress: "Sheet1!A1:C8" });
    const callback = createClearAutoFilterRange(
      h.getRange,
      h.getSheet,
      h.supported,
    );
    await callback(h.context, { args: [2], column_count: 3 });
    expect(h.autoFilter.clearColumnCriteria).toHaveBeenLastCalledWith(1);

    h.autoFilter.clearColumnCriteria.mockClear();
    await callback(h.context, { args: [null], column_count: 3 });
    expect(h.autoFilter.clearColumnCriteria.mock.calls).toEqual([
      [0],
      [1],
      [2],
    ]);
  });

  it("treats clearing a nonmatching or absent range filter as a no-op", async () => {
    for (const existingAddress of [null, "Sheet1!E1:G8"]) {
      const h = rangeHarness({ existingAddress });
      await createClearAutoFilterRange(
        h.getRange,
        h.getSheet,
        h.supported,
      )(h.context, { args: [null], column_count: 3 });
      expect(h.autoFilter.clearColumnCriteria).not.toHaveBeenCalled();
    }
  });
});

describe("table AutoFilter action callbacks", () => {
  it("applies values and custom comparison filters", async () => {
    const h = tableHarness();
    const callback = createApplyAutoFilterTable(h.getTable, h.supported);
    await callback(h.context, {
      args: [0, 1, { type: "values", values: ["Open"] }],
      column_count: 3,
    });
    await callback(h.context, {
      args: [
        0,
        2,
        { type: "comparison", operator: "greater_than", value1: "5" },
      ],
      column_count: 3,
    });
    expect(h.filters[0].applyValuesFilter).toHaveBeenCalledWith(["Open"]);
    expect(h.filters[1].applyCustomFilter).toHaveBeenCalledWith(
      ">5",
      undefined,
      undefined,
    );
    expect(h.supported).toHaveBeenCalledWith("ExcelApi", "1.2");
  });

  it("clears one field or every field individually", async () => {
    const h = tableHarness();
    const callback = createClearAutoFilterTable(h.getTable, h.supported);
    await callback(h.context, { args: [0, 2], column_count: 3 });
    expect(h.filters.map((filter) => filter.clear.mock.calls.length)).toEqual([
      0, 1, 0,
    ]);

    await callback(h.context, { args: [0, null], column_count: 3 });
    expect(h.filters.map((filter) => filter.clear.mock.calls.length)).toEqual([
      1, 2, 1,
    ]);
  });
});

describe("AutoFilter validation and dispatch errors", () => {
  it("rejects unsupported hosts and malformed payloads before resolving targets", async () => {
    const h = rangeHarness();
    h.supported.mockReturnValue(false);
    const callback = createApplyAutoFilterRange(
      h.getRange,
      h.getSheet,
      h.supported,
    );
    await expect(
      callback(h.context, {
        args: [1, { type: "values", values: ["East"] }],
        column_count: 3,
      }),
    ).rejects.toThrow("ExcelApi 1.14");
    expect(h.getRange).not.toHaveBeenCalled();
  });

  it.each([
    [[0, { type: "values", values: ["East"] }], "field"],
    [[1, { type: "values", values: [] }], "non-empty"],
    [[1, { type: "comparison", operator: "between", value1: "1" }], "value2"],
    [
      [1, { type: "comparison", operator: "approximately", value1: "1" }],
      "Unknown AutoFilter comparison operator",
    ],
  ])("rejects invalid action args %j", async (args, message) => {
    const h = rangeHarness();
    const callback = createApplyAutoFilterRange(
      h.getRange,
      h.getSheet,
      h.supported,
    );
    await expect(
      callback(h.context, { args, column_count: 3 }),
    ).rejects.toThrow(message);
    expect(h.getRange).not.toHaveBeenCalled();
  });

  it("preserves structured partial-failure metadata for a protected-sheet error", async () => {
    const h = tableHarness();
    h.context.sync.mockRejectedValueOnce(
      new Error("The worksheet is protected"),
    );
    const actions = [
      { func: "first" },
      {
        func: "applyAutoFilterTable",
        args: [0, 1, { type: "values", values: ["East"] }],
        column_count: 3,
      },
    ];
    await expect(
      dispatchActions(actions, h.context, {
        first: vi.fn(async () => {}),
        applyAutoFilterTable: createApplyAutoFilterTable(
          h.getTable,
          h.supported,
        ),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      actionFunc: "applyAutoFilterTable",
    });
  });
});
