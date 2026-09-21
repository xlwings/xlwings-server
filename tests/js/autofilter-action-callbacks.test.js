import { describe, expect, it, vi } from "vitest";

import {
  createApplyAutoFilterRange,
  createApplyAutoFilterTable,
  createClearAutoFilterRange,
  createClearAutoFilterTable,
  createGetAutoFilterCriteria,
  normalizeAutoFilterCriteria,
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
  const sheet = {
    name: "Sheet1",
    autoFilter,
    load: vi.fn(function () {
      return this;
    }),
  };
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
    applyTopItemsFilter: vi.fn(),
    applyBottomItemsFilter: vi.fn(),
    applyTopPercentFilter: vi.fn(),
    applyBottomPercentFilter: vi.fn(),
    clear: vi.fn(),
  }));
  const table = {
    name: "Table1",
    load: vi.fn(function () {
      return this;
    }),
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
    ["equal_to", undefined, undefined, { filterOn: "Custom", criterion1: "=" }],
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

  it("formats date operands invariantly and applies top/bottom criteria", async () => {
    const h = rangeHarness();
    const callback = createApplyAutoFilterRange(
      h.getRange,
      h.getSheet,
      h.supported,
    );
    await callback(h.context, {
      args: [
        1,
        {
          type: "comparison",
          operator: "between",
          value1: { type: "date", value: "2026-01-02" },
          value2: { type: "datetime", value: "2026-03-04T05:06:07.5" },
        },
      ],
      column_count: 3,
    });
    expect(h.autoFilter.apply).toHaveBeenLastCalledWith(h.range, 0, {
      filterOn: "Custom",
      criterion1: ">=1/2/2026",
      criterion2: "<=3/4/2026 5:6:07.5",
      operator: "And",
    });

    await callback(h.context, {
      args: [2, { type: "top_percent", value: 12.5 }],
      column_count: 3,
    });
    expect(h.autoFilter.apply).toHaveBeenLastCalledWith(h.range, 1, {
      filterOn: "TopPercent",
      criterion1: "12.5",
    });
  });

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

    for (const args of [[null], [undefined], []]) {
      h.autoFilter.clearColumnCriteria.mockClear();
      await callback(h.context, { args, column_count: 3 });
      expect(h.autoFilter.clearColumnCriteria.mock.calls).toEqual([
        [0],
        [1],
        [2],
      ]);
    }
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

  it("uses the native table top/bottom helpers", async () => {
    const h = tableHarness();
    const callback = createApplyAutoFilterTable(h.getTable, h.supported);
    await callback(h.context, {
      args: [0, 2, { type: "bottom_items", value: 7 }],
      column_count: 3,
    });
    await callback(h.context, {
      args: [0, 3, { type: "top_percent", value: 25 }],
      column_count: 3,
    });
    expect(h.filters[1].applyBottomItemsFilter).toHaveBeenCalledWith(7);
    expect(h.filters[2].applyTopPercentFilter).toHaveBeenCalledWith(25);
  });

  it("clears one field or every field individually", async () => {
    const h = tableHarness();
    const callback = createClearAutoFilterTable(h.getTable, h.supported);
    await callback(h.context, { args: [0, 2], column_count: 3 });
    expect(h.filters.map((filter) => filter.clear.mock.calls.length)).toEqual([
      0, 1, 0,
    ]);

    for (const args of [[0, null], [0, undefined], [0]]) {
      h.filters.forEach((filter) => filter.clear.mockClear());
      await callback(h.context, { args, column_count: 3 });
      expect(h.filters.map((filter) => filter.clear.mock.calls.length)).toEqual(
        [1, 1, 1],
      );
    }
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
    [[1, { type: "top_items", value: 0 }], "between 1 and 255"],
    [[1, { type: "bottom_percent", value: 101 }], "between 0 and 100"],
    [
      [
        1,
        {
          type: "comparison",
          operator: "equal_to",
          value1: { type: "date", value: "2026-02-30" },
        },
      ],
      "Invalid AutoFilter date",
    ],
    [
      [
        1,
        {
          type: "comparison",
          operator: "equal_to",
          value1: { type: "datetime", value: "2026-02-20T24:00:00" },
        },
      ],
      "Invalid AutoFilter date",
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

describe("AutoFilter criteria inspection", () => {
  it.each([
    [
      { filterOn: "Values", values: ["East", "West"] },
      { type: "values", values: ["East", "West"] },
    ],
    [
      {
        filterOn: "Values",
        values: { 0: "East", 1: "West", length: 2 },
      },
      { type: "values", values: ["East", "West"] },
    ],
    [
      { filterOn: "Unknown", values: ["East", "West"] },
      { type: "values", values: ["East", "West"] },
    ],
    [
      {
        filterOn: "Custom",
        criterion1: ">=1/1/2026",
        criterion2: "<=3/31/2026",
        operator: "And",
      },
      {
        type: "comparison",
        operator: "between",
        value1: "1/1/2026",
        value2: "3/31/2026",
      },
    ],
    [
      { filterOn: "BottomItems", criterion1: "7" },
      { type: "bottom_items", count: 7 },
    ],
    [
      { filterOn: "TopPercent", criterion1: "12.5" },
      { type: "top_percent", percent: 12.5 },
    ],
    [
      { filterOn: "TopItems", criterion1: ">=42" },
      { type: "top_items", count: null },
    ],
    [{ filterOn: "Dynamic" }, { type: "unknown" }],
    [{ filterOn: "Unknown" }, { type: "unknown" }],
    [{ filterOn: "Custom" }, { type: "none" }],
  ])("normalizes %j", (criteria, expected) => {
    expect(normalizeAutoFilterCriteria(2, criteria)).toMatchObject({
      field: 2,
      ...expected,
    });
  });

  it("reads matching range criteria and returns none for a different range", async () => {
    const range = {
      address: "Sheet1!$A$1:$C$8",
      columnCount: 3,
      load: vi.fn(function () {
        return this;
      }),
    };
    const filteredRange = {
      address: "Sheet1!$A$1:$C$8",
      isNullObject: false,
      load: vi.fn(function () {
        return this;
      }),
    };
    const autoFilter = {
      criteria: [
        { filterOn: "Values", values: ["East"] },
        {},
        { filterOn: "TopItems", criterion1: "5" },
      ],
      load: vi.fn(function () {
        return this;
      }),
      getRangeOrNullObject: vi.fn(() => filteredRange),
    };
    const sheet = { getRange: vi.fn(() => range), autoFilter };
    const context = {
      workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
      sync: vi.fn(async () => {}),
    };
    const read = createGetAutoFilterCriteria(
      async (callback) => await callback(context),
      vi.fn(() => true),
    );

    expect(await read("Sheet1", "A1:C8")).toMatchObject([
      { field: 1, type: "values", values: ["East"] },
      { field: 2, type: "none" },
      { field: 3, type: "top_items", count: 5 },
    ]);

    filteredRange.address = "Sheet1!E1:G8";
    expect(await read("Sheet1", "A1:C8")).toMatchObject([
      { type: "none" },
      { type: "none" },
      { type: "none" },
    ]);
  });

  it("uses successfully applied values when a range host reports Unknown", async () => {
    const criteriaCache = new Map();
    const applyHarness = rangeHarness();
    await createApplyAutoFilterRange(
      applyHarness.getRange,
      applyHarness.getSheet,
      applyHarness.supported,
      criteriaCache,
    )(applyHarness.context, {
      args: [1, { type: "values", values: ["East", "West"] }],
      column_count: 3,
    });

    const range = {
      address: "Sheet1!$A$1:$C$8",
      columnCount: 3,
      load: vi.fn(function () {
        return this;
      }),
    };
    const filteredRange = {
      address: range.address,
      isNullObject: false,
      load: vi.fn(function () {
        return this;
      }),
    };
    const autoFilter = {
      criteria: [{ filterOn: "Unknown" }, {}, {}],
      load: vi.fn(function () {
        return this;
      }),
      getRangeOrNullObject: vi.fn(() => filteredRange),
    };
    const context = {
      workbook: {
        worksheets: {
          getItem: vi.fn(() => ({
            getRange: vi.fn(() => range),
            autoFilter,
          })),
        },
      },
      sync: vi.fn(async () => {}),
    };
    const read = createGetAutoFilterCriteria(
      async (callback) => await callback(context),
      vi.fn(() => true),
      criteriaCache,
    );

    expect(await read("Sheet1", "A1:C8")).toMatchObject([
      { type: "values", values: ["East", "West"] },
      { type: "none" },
      { type: "none" },
    ]);

    applyHarness.filteredRange.isNullObject = false;
    applyHarness.filteredRange.address = applyHarness.range.address;
    await createClearAutoFilterRange(
      applyHarness.getRange,
      applyHarness.getSheet,
      applyHarness.supported,
      criteriaCache,
    )(applyHarness.context, { args: [1], column_count: 3 });
    expect(await read("Sheet1", "A1:C8")).toMatchObject([
      { type: "unknown" },
      { type: "none" },
      { type: "none" },
    ]);
  });

  it("reads every table column through its Filter object", async () => {
    const filters = [
      { criteria: { filterOn: "BottomPercent", criterion1: "20" } },
      { criteria: { filterOn: "Custom", criterion1: "<>" } },
    ];
    for (const filter of filters) {
      filter.load = vi.fn(function () {
        return this;
      });
    }
    const columns = {
      items: filters.map((filter) => ({ filter })),
      load: vi.fn(function () {
        return this;
      }),
    };
    const table = {
      name: "Table1",
      columns,
      load: vi.fn(function () {
        return this;
      }),
    };
    const sheet = { tables: { getItemAt: vi.fn(() => table) } };
    const context = {
      workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
      sync: vi.fn(async () => {}),
    };
    const read = createGetAutoFilterCriteria(
      async (callback) => await callback(context),
      vi.fn(() => true),
    );
    expect(await read("Sheet1", "A1:B8", 0)).toMatchObject([
      { field: 1, type: "bottom_percent", percent: 20 },
      {
        field: 2,
        type: "comparison",
        operator: "not_equal_to",
        value1: null,
      },
    ]);
  });

  it("uses successfully applied values when a table host reports Unknown", async () => {
    const criteriaCache = new Map();
    const applyHarness = tableHarness();
    await createApplyAutoFilterTable(
      applyHarness.getTable,
      applyHarness.supported,
      criteriaCache,
    )(applyHarness.context, {
      args: [0, 1, { type: "values", values: ["East"] }],
      column_count: 3,
      sheet_position: 0,
    });

    const filter = {
      criteria: { filterOn: "Unknown" },
      load: vi.fn(function () {
        return this;
      }),
    };
    const table = {
      name: "Table1",
      columns: {
        items: [{ filter }],
        load: vi.fn(function () {
          return this;
        }),
      },
      load: vi.fn(function () {
        return this;
      }),
    };
    const context = {
      workbook: {
        worksheets: {
          getItem: vi.fn(() => ({
            tables: { getItemAt: vi.fn(() => table) },
          })),
        },
      },
      sync: vi.fn(async () => {}),
    };
    const read = createGetAutoFilterCriteria(
      async (callback) => await callback(context),
      vi.fn(() => true),
      criteriaCache,
    );

    expect(await read("Sheet1", "A1:A8", 0)).toMatchObject([
      { type: "values", values: ["East"] },
    ]);

    await createClearAutoFilterTable(
      applyHarness.getTable,
      applyHarness.supported,
      criteriaCache,
    )(applyHarness.context, {
      args: [0, 1],
      column_count: 3,
      sheet_position: 0,
    });
    expect(await read("Sheet1", "A1:A8", 0)).toMatchObject([
      { type: "unknown" },
    ]);
  });
});
