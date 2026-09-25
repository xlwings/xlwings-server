import { describe, expect, it, vi } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";
import { createRangeSort } from "../../xlwings_server/static/js/custom-scripts/range-sort.js";

function harness({ table = null, failSort = false } = {}) {
  const sort = { apply: vi.fn() };
  const range = { sort };
  const sheet = {
    tables: {
      load: vi.fn(() => ({
        items: table
          ? [
              {
                getRange: () => ({
                  ...table,
                  load() {
                    return this;
                  },
                }),
              },
            ]
          : [],
      })),
    },
    getRangeByIndexes: vi.fn(() => range),
  };
  const getSheet = vi.fn(async () => sheet);
  let syncCount = 0;
  const context = {
    sync: vi.fn(async () => {
      syncCount += 1;
      if (failSort && syncCount === 3) throw new Error("Protected sheet");
    }),
  };
  const action = {
    func: "rangeSort",
    sheet_position: 0,
    start_row: 1,
    start_column: 2,
    row_count: 4,
    column_count: 3,
    args: [[2, 1], [false, true], true],
  };
  return { sort, sheet, getSheet, context, action };
}

describe("range sort action", () => {
  it("sorts the exact rectangle by ordered relative columns", async () => {
    const h = harness();
    await createRangeSort(h.getSheet)(h.context, h.action);
    expect(h.sheet.getRangeByIndexes).toHaveBeenCalledWith(1, 2, 4, 3);
    expect(h.sort.apply).toHaveBeenCalledWith(
      [
        { key: 1, ascending: false, sortOn: "Value" },
        { key: 0, ascending: true, sortOn: "Value" },
      ],
      false,
      true,
      "Rows",
    );
    expect(h.context.sync).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid payloads and table intersections before sorting", async () => {
    const h = harness();
    h.action.args = [[2, 2], [true, false], true];
    await expect(
      createRangeSort(h.getSheet)(h.context, h.action),
    ).rejects.toMatchObject({
      code: "invalid_range_sort",
    });
    expect(h.getSheet).not.toHaveBeenCalled();

    const t = harness({
      table: { rowIndex: 3, columnIndex: 3, rowCount: 2, columnCount: 2 },
    });
    await expect(
      createRangeSort(t.getSheet)(t.context, t.action),
    ).rejects.toMatchObject({
      code: "sort_table_range",
    });
    expect(t.sort.apply).not.toHaveBeenCalled();
  });

  it("reports a protected-sheet failure as a structured action error", async () => {
    const h = harness({ failSort: true });
    await expect(
      dispatchActions([h.action], h.context, {
        rangeSort: createRangeSort(h.getSheet),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      appliedActionCount: 1,
      actionFunc: "rangeSort",
    });
  });

  it("reports a missing worksheet as a structured action error", async () => {
    const h = harness();
    const getSheet = vi.fn(async () => {
      throw new Error("Worksheet is missing");
    });
    await expect(
      dispatchActions([h.action], h.context, {
        rangeSort: createRangeSort(getSheet),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      actionFunc: "rangeSort",
    });
    expect(h.sort.apply).not.toHaveBeenCalled();
  });

  it("reports earlier actions when a later sort fails", async () => {
    const h = harness({ failSort: true });
    const priorAction = vi.fn(async () => {});
    await expect(
      dispatchActions([{ func: "priorAction" }, h.action], h.context, {
        priorAction,
        rangeSort: createRangeSort(h.getSheet),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      actionFunc: "rangeSort",
    });
    expect(priorAction).toHaveBeenCalledOnce();
  });
});
