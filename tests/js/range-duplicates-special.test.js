import { describe, expect, it, vi } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";
import {
  createGetSpecialCells,
  createRangeRemoveDuplicates,
} from "../../xlwings_server/static/js/custom-scripts/range-duplicates-special.js";

function duplicateHarness({ table = null, failSync = false } = {}) {
  const range = { removeDuplicates: vi.fn() };
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
  let syncCount = 0;
  const context = {
    sync: vi.fn(async () => {
      syncCount += 1;
      if (failSync && syncCount === 3) throw new Error("Protected sheet");
    }),
  };
  return {
    range,
    sheet,
    context,
    getSheet: vi.fn(async () => sheet),
    action: {
      func: "rangeRemoveDuplicates",
      sheet_position: 0,
      start_row: 1,
      start_column: 2,
      row_count: 4,
      column_count: 3,
      args: [[2, 1], true],
    },
  };
}

describe("range duplicate removal", () => {
  it("uses zero-based keys within the exact rectangle", async () => {
    const h = duplicateHarness();
    await createRangeRemoveDuplicates(h.getSheet, () => true)(
      h.context,
      h.action,
    );
    expect(h.sheet.getRangeByIndexes).toHaveBeenCalledWith(1, 2, 4, 3);
    expect(h.range.removeDuplicates).toHaveBeenCalledWith([1, 0], true);
    expect(h.context.sync).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid keys, unsupported hosts, and table overlap before mutation", async () => {
    const h = duplicateHarness();
    h.action.args = [[1, 1], true];
    await expect(
      createRangeRemoveDuplicates(h.getSheet, () => true)(h.context, h.action),
    ).rejects.toMatchObject({ code: "invalid_range_remove_duplicates" });
    expect(h.getSheet).not.toHaveBeenCalled();
    h.action.args = [[1], true];
    await expect(
      createRangeRemoveDuplicates(h.getSheet, () => false)(h.context, h.action),
    ).rejects.toMatchObject({ code: "unsupported_range_operations" });
    const t = duplicateHarness({
      table: { rowIndex: 2, columnIndex: 3, rowCount: 2, columnCount: 2 },
    });
    await expect(
      createRangeRemoveDuplicates(t.getSheet, () => true)(t.context, t.action),
    ).rejects.toMatchObject({ code: "remove_duplicates_table_range" });
    expect(t.range.removeDuplicates).not.toHaveBeenCalled();
  });

  it("reports missing sheets and protected sheets as structured action failures", async () => {
    const missing = duplicateHarness();
    await expect(
      dispatchActions([missing.action], missing.context, {
        rangeRemoveDuplicates: createRangeRemoveDuplicates(
          async () => {
            throw new Error("Worksheet is missing");
          },
          () => true,
        ),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      actionFunc: "rangeRemoveDuplicates",
    });
    const protectedSheet = duplicateHarness({ failSync: true });
    await expect(
      dispatchActions([protectedSheet.action], protectedSheet.context, {
        rangeRemoveDuplicates: createRangeRemoveDuplicates(
          protectedSheet.getSheet,
          () => true,
        ),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      appliedActionCount: 1,
      actionFunc: "rangeRemoveDuplicates",
    });
  });

  it("reports prior actions when duplicate removal fails", async () => {
    const h = duplicateHarness({ failSync: true });
    const priorAction = vi.fn(async () => {});
    await expect(
      dispatchActions([{ func: "priorAction" }, h.action], h.context, {
        priorAction,
        rangeRemoveDuplicates: createRangeRemoveDuplicates(
          h.getSheet,
          () => true,
        ),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      actionFunc: "rangeRemoveDuplicates",
    });
    expect(priorAction).toHaveBeenCalledOnce();
  });
});

function specialHarness({ missing = false, fail = false } = {}) {
  const areas = {
    isNullObject: missing,
    areas: {
      items: [{ address: "Data!$A$2" }, { address: "Data!$C$4:$D$6" }],
    },
    load: vi.fn(function () {
      return this;
    }),
  };
  const range = { getSpecialCellsOrNullObject: vi.fn(() => areas) };
  const sheet = { getRange: vi.fn(() => range) };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
    sync: vi.fn(async () => {
      if (fail) throw new Error("Protected sheet");
    }),
  };
  const run = vi.fn(async (callback) => callback(context));
  return { areas, range, sheet, context, run };
}

describe("special cell read", () => {
  it("returns every rectangular area as a sheet-local address", async () => {
    const h = specialHarness();
    const read = createGetSpecialCells(h.run, () => true);
    expect(await read("Data", "A1:D10", "constants", "numbers")).toEqual([
      "$A$2",
      "$C$4:$D$6",
    ]);
    expect(h.range.getSpecialCellsOrNullObject).toHaveBeenCalledWith(
      "Constants",
      "Numbers",
    );
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it("returns an empty list for no match", async () => {
    const h = specialHarness({ missing: true });
    expect(
      await createGetSpecialCells(h.run, () => true)(
        "Data",
        "A1:D10",
        "formulas",
        null,
      ),
    ).toEqual([]);
  });

  it("validates before Excel.run and reports host failures", async () => {
    const h = specialHarness();
    const read = createGetSpecialCells(h.run, () => true);
    await expect(read("Data", "A1", "visible", "text")).rejects.toMatchObject({
      code: "invalid_special_cells",
    });
    expect(h.run).not.toHaveBeenCalled();
    await expect(
      createGetSpecialCells(h.run, () => false)("Data", "A1", "visible"),
    ).rejects.toMatchObject({ code: "unsupported_range_operations" });
    const missing = specialHarness({ fail: true });
    await expect(
      createGetSpecialCells(missing.run, () => true)("Data", "A1", "visible"),
    ).rejects.toMatchObject({ code: "special_cells_failed" });
  });
});
