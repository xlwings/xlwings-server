import { describe, expect, it, vi } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";
import { createSetValues } from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";

describe("dispatchActions", () => {
  it("dispatches actions in order and preserves sheet sync behavior", async () => {
    const seen = [];
    const context = { sync: vi.fn(async () => seen.push("sync")) };
    const callbacks = {
      setValues: vi.fn(async () => seen.push("values")),
      addSheet: vi.fn(async () => seen.push("sheet")),
    };

    await dispatchActions(
      [{ func: "setValues" }, { func: "addSheet" }],
      context,
      callbacks,
    );

    expect(seen).toEqual(["values", "sheet", "sync"]);
  });

  it("syncs a new sheet before later writes and table creation", async () => {
    const seen = [];
    const context = { sync: vi.fn(async () => seen.push("sync")) };
    const callbacks = {
      addSheet: vi.fn(async () => seen.push("add sheet")),
      setValues: vi.fn(async () => seen.push("write values")),
      addTable: vi.fn(async () => seen.push("add table")),
    };

    await dispatchActions(
      [{ func: "addSheet" }, { func: "setValues" }, { func: "addTable" }],
      context,
      callbacks,
    );

    expect(seen).toEqual(["add sheet", "sync", "write values", "add table"]);
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it("reports a table-row preflight refusal after earlier actions as possible partial", async () => {
    const addTable = vi.fn(async () => {});
    const addTableRow = vi.fn(async () => {
      const error = new Error("Cells below the table would move");
      error.code = "table_row_neighbor_cells";
      throw error;
    });
    await expect(
      dispatchActions(
        [{ func: "addTable" }, { func: "addTableRow" }],
        { sync: vi.fn(async () => {}) },
        { addTable, addTableRow },
      ),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      actionFunc: "addTableRow",
      cause: { code: "table_row_neighbor_cells" },
    });
    expect(addTable).toHaveBeenCalledOnce();
    expect(addTableRow).toHaveBeenCalledOnce();
  });

  it("reports an unknown action with its batch position", async () => {
    await expect(
      dispatchActions([{ func: "missing" }], { sync: vi.fn() }, {}),
    ).rejects.toMatchObject({
      code: "unknown_action",
      actionIndex: 0,
      appliedActionCount: 0,
      actionFunc: "missing",
    });
  });

  it("stops before the third write when the second write's sync rejects", async () => {
    const ranges = [{}, {}, {}];
    const actions = ranges.map((_, index) => ({
      func: "setValues",
      start_row: index,
      values: [[index]],
    }));
    const cause = new Error("Excel rejected the second chunk");
    const context = {
      sync: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(cause),
    };
    const getRange = vi.fn(async (_, action) => ranges[action.start_row]);

    await expect(
      dispatchActions(actions, context, {
        setValues: createSetValues(getRange),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      actionFunc: "setValues",
      cause,
    });
    expect(context.sync).toHaveBeenCalledTimes(2);
    expect(getRange).toHaveBeenCalledTimes(2);
    expect(ranges[0].values).toEqual([[0]]);
    expect(ranges[2].values).toBeUndefined();
  });

  it("wraps callback failures with their batch position", async () => {
    await expect(
      dispatchActions(
        [{ func: "setValues" }],
        { sync: vi.fn() },
        {
          setValues: async () => Promise.reject(new Error("Excel rejected it")),
        },
      ),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      appliedActionCount: 1,
      actionFunc: "setValues",
    });
  });

  it("makes partial execution explicit when a later action fails", async () => {
    await expect(
      dispatchActions(
        [{ func: "setValues" }, { func: "addSheet" }],
        { sync: vi.fn(async () => {}) },
        {
          setValues: async () => {},
          addSheet: async () => Promise.reject(new Error("protected")),
        },
      ),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      message: expect.stringContaining(
        "Up to 2 actions may already have been applied, including the failing action",
      ),
    });
  });
});
