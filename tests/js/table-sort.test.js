import { describe, expect, it, vi } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";
import { createTableSort } from "../../xlwings_server/static/js/custom-scripts/table-sort.js";

function harness({
  failSort = false,
  missing = false,
  showHeaders = true,
} = {}) {
  const sort = { apply: vi.fn() };
  const bodySort = { apply: vi.fn() };
  const table = {
    sort,
    showHeaders,
    load: vi.fn(),
    getDataBodyRange: vi.fn(() => ({ sort: bodySort })),
  };
  const getTable = vi.fn(async () => (missing ? undefined : table));
  const context = {
    sync: vi.fn(async () => {
      if (failSort) throw new Error("Protected sheet");
    }),
  };
  const action = {
    func: "tableSort",
    sheet_position: 0,
    args: [1, [3, 1], [false, true]],
  };
  return { sort, bodySort, table, getTable, context, action };
}

describe("table sort action", () => {
  it("applies Excel's table sort with zero-based keys", async () => {
    const h = harness();
    await createTableSort(h.getTable)(h.context, h.action);
    expect(h.getTable).toHaveBeenCalledWith(h.context, h.action);
    expect(h.sort.apply).toHaveBeenCalledWith(
      [
        { key: 2, ascending: false, sortOn: "Value" },
        { key: 0, ascending: true, sortOn: "Value" },
      ],
      false,
    );
    expect(h.bodySort.apply).not.toHaveBeenCalled();
  });

  it("sorts the data body when the header row is hidden", async () => {
    const h = harness({ showHeaders: false });
    await createTableSort(h.getTable)(h.context, h.action);
    expect(h.table.load).toHaveBeenCalledWith("showHeaders");
    expect(h.sort.apply).not.toHaveBeenCalled();
    expect(h.bodySort.apply).toHaveBeenCalledWith(
      [
        { key: 2, ascending: false, sortOn: "Value" },
        { key: 0, ascending: true, sortOn: "Value" },
      ],
      false,
      false,
      "Rows",
    );
  });

  it.each([
    [[1, [], []]],
    [[1, [2, 2], [true, false]]],
    [[1, [0], [true]]],
    [[1, [1, 2], [true]]],
    [[1, [1], [1]]],
    [[-1, [1], [true]]],
    [["Products", [1], [true]]],
  ])("rejects invalid payload %j before sorting", async (args) => {
    const h = harness();
    h.action.args = args;
    await expect(
      createTableSort(h.getTable)(h.context, h.action),
    ).rejects.toMatchObject({ code: "invalid_table_sort" });
    expect(h.getTable).not.toHaveBeenCalled();
  });

  it("rejects a missing table", async () => {
    const h = harness({ missing: true });
    await expect(
      createTableSort(h.getTable)(h.context, h.action),
    ).rejects.toMatchObject({ code: "table_not_found" });
  });

  it("reports a failed sort as a structured action error", async () => {
    const h = harness({ failSort: true });
    await expect(
      dispatchActions([h.action], h.context, {
        tableSort: createTableSort(h.getTable),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      actionFunc: "tableSort",
    });
  });
});
