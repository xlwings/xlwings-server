import { describe, expect, it, vi } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";
import {
  createFindRange,
  createRangeReplaceAll,
} from "../../xlwings_server/static/js/custom-scripts/range-find-replace.js";

function columnName(index) {
  let name = "";
  for (
    let number = index + 1;
    number > 0;
    number = Math.floor((number - 1) / 26)
  ) {
    name = String.fromCharCode(65 + ((number - 1) % 26)) + name;
  }
  return name;
}

function cellAddress(row, column) {
  return `$${columnName(column)}$${row + 1}`;
}

function harness(values, selection) {
  const requested = [];
  function proxy(rowIndex, columnIndex, rowCount, columnCount) {
    const address =
      `Sheet1!${cellAddress(rowIndex, columnIndex)}` +
      (rowCount === 1 && columnCount === 1
        ? ""
        : `:${cellAddress(
            rowIndex + rowCount - 1,
            columnIndex + columnCount - 1,
          )}`);
    return {
      address,
      rowIndex,
      columnIndex,
      rowCount,
      columnCount,
      load() {
        return this;
      },
      findOrNullObject(text, criteria) {
        requested.push({
          rowIndex,
          columnIndex,
          rowCount,
          columnCount,
          criteria,
        });
        const matches = [];
        for (let row = rowIndex; row < rowIndex + rowCount; row += 1) {
          for (
            let column = columnIndex;
            column < columnIndex + columnCount;
            column += 1
          ) {
            const value = String(values[row]?.[column] ?? "");
            const haystack = criteria.matchCase ? value : value.toLowerCase();
            const needle = criteria.matchCase ? text : text.toLowerCase();
            if (
              criteria.completeMatch
                ? haystack === needle
                : haystack.includes(needle)
            ) {
              matches.push({ row, column });
            }
          }
        }
        if (criteria.searchDirection === "Backwards") matches.reverse();
        const first = matches[0];
        return {
          isNullObject: !first,
          address: first
            ? `Sheet1!${cellAddress(first.row, first.column)}`
            : null,
          load() {
            return this;
          },
        };
      },
    };
  }
  const range = proxy(...selection);
  const sheet = {
    getRange: vi.fn(() => range),
    getRangeByIndexes: vi.fn((...dimensions) => proxy(...dimensions)),
  };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
    sync: vi.fn(async () => {}),
  };
  const run = vi.fn(async (callback) => callback(context));
  const find = createFindRange(run, () => true);
  return { find, run, sheet, requested, context };
}

describe("range find read", () => {
  it("narrows to the first matching row and returns null when no match exists", async () => {
    const h = harness(
      [
        ["x", "needle"],
        ["needle", "x"],
      ],
      [0, 0, 2, 2],
    );
    expect(
      await h.find("Sheet1", "A1:B2", "needle", true, "forward", "rows", false),
    ).toBe("$B$1");
    expect(
      await h.find("Sheet1", "A1:B2", "absent", true, "forward", "rows", false),
    ).toBeNull();
    expect(h.sheet.getRangeByIndexes).toHaveBeenCalledWith(0, 0, 1, 2);
    expect(
      await h.find(
        "Sheet1",
        "A1:B2",
        "needle",
        true,
        "backward",
        "rows",
        false,
      ),
    ).toBe("$A$2");
  });

  it("searches column strips in the requested direction", async () => {
    const h = harness(
      [
        ["x", "needle"],
        ["needle", "x"],
      ],
      [0, 0, 2, 2],
    );
    expect(
      await h.find(
        "Sheet1",
        "A1:B2",
        "needle",
        true,
        "forward",
        "columns",
        false,
      ),
    ).toBe("$A$2");
    expect(
      await h.find(
        "Sheet1",
        "A1:B2",
        "needle",
        true,
        "backward",
        "columns",
        false,
      ),
    ).toBe("$B$1");
    expect(h.requested).toContainEqual(
      expect.objectContaining({ rowCount: 2, columnCount: 1 }),
    );
  });

  it("continues into the other half when the first half has no match", async () => {
    const h = harness(
      [
        ["x", "x"],
        ["x", "needle"],
      ],
      [0, 0, 2, 2],
    );
    expect(
      await h.find("Sheet1", "A1:B2", "needle", true, "forward", "rows", false),
    ).toBe("$B$2");
    expect(
      await h.find(
        "Sheet1",
        "A1:B2",
        "needle",
        true,
        "forward",
        "columns",
        false,
      ),
    ).toBe("$B$2");
  });

  it("keeps a single-cell search inside the cell", async () => {
    const h = harness([["other", "needle"]], [0, 0, 1, 1]);
    expect(
      await h.find("Sheet1", "A1", "needle", false, "forward", "rows", false),
    ).toBeNull();
    expect(h.requested[0]).toMatchObject({ rowCount: 1, columnCount: 2 });

    const matched = harness([["needle", "needle"]], [0, 0, 1, 1]);
    expect(
      await matched.find(
        "Sheet1",
        "A1",
        "needle",
        true,
        "backward",
        "columns",
        false,
      ),
    ).toBe("$A$1");

    const lastColumn = [];
    lastColumn[16382] = "needle";
    lastColumn[16383] = "needle";
    const edge = harness([lastColumn], [0, 16383, 1, 1]);
    expect(
      await edge.find(
        "Sheet1",
        "XFD1",
        "needle",
        true,
        "forward",
        "rows",
        false,
      ),
    ).toBe("$XFD$1");
  });

  it("rejects invalid arguments and unsupported hosts before Excel.run", async () => {
    const h = harness([["x"]], [0, 0, 1, 1]);
    await expect(
      h.find("Sheet1", "A1", "", false, "forward", "rows", false),
    ).rejects.toMatchObject({ code: "invalid_range_find" });
    expect(h.run).not.toHaveBeenCalled();

    const unsupported = createFindRange(h.run, () => false);
    await expect(
      unsupported("Sheet1", "A1", "x", false, "forward", "rows", false),
    ).rejects.toMatchObject({ code: "unsupported_range_search" });
    expect(h.run).not.toHaveBeenCalled();
  });

  it("propagates a missing-sheet failure", async () => {
    const h = harness([["x"]], [0, 0, 1, 1]);
    h.context.workbook.worksheets.getItem.mockImplementation(() => {
      throw new Error("Worksheet is missing");
    });
    await expect(
      h.find("Sheet1", "A1", "x", false, "forward", "rows", false),
    ).rejects.toMatchObject({
      code: "range_find_failed",
      cause: expect.objectContaining({ message: "Worksheet is missing" }),
    });
  });
});

describe("range replacement action", () => {
  function replacementHarness(fail = false) {
    const replaceAll = vi.fn();
    const getRange = vi.fn(async () => ({ replaceAll }));
    const context = {
      sync: vi.fn(async () => {
        if (fail) throw new Error("Protected sheet");
      }),
    };
    const action = {
      func: "rangeReplaceAll",
      sheet_position: 0,
      start_row: 0,
      start_column: 0,
      row_count: 2,
      column_count: 2,
      args: ["old", "", true, false],
    };
    return { replaceAll, getRange, context, action };
  }

  it("replaces inside the selected native range and syncs the action", async () => {
    const h = replacementHarness();
    await createRangeReplaceAll(h.getRange, () => true)(h.context, h.action);
    expect(h.getRange).toHaveBeenCalledWith(h.context, h.action);
    expect(h.replaceAll).toHaveBeenCalledWith("old", "", {
      completeMatch: true,
      matchCase: false,
    });
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it("rejects malformed actions before touching Excel", async () => {
    const h = replacementHarness();
    h.action.args = ["", "new", false, false];
    await expect(
      createRangeReplaceAll(h.getRange, () => true)(h.context, h.action),
    ).rejects.toMatchObject({ code: "invalid_range_replace" });
    expect(h.getRange).not.toHaveBeenCalled();
  });

  it("reports a protected-sheet failure as a possibly applied action", async () => {
    const h = replacementHarness(true);
    await expect(
      dispatchActions([h.action], h.context, {
        rangeReplaceAll: createRangeReplaceAll(h.getRange, () => true),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      appliedActionCount: 1,
      actionFunc: "rangeReplaceAll",
    });
  });

  it("reports a missing target and prior actions without hiding partial dispatch", async () => {
    const h = replacementHarness();
    const missingRange = vi.fn(async () => {
      throw new Error("Worksheet is missing");
    });
    const priorAction = vi.fn(async () => {});
    await expect(
      dispatchActions([{ func: "priorAction" }, h.action], h.context, {
        priorAction,
        rangeReplaceAll: createRangeReplaceAll(missingRange, () => true),
      }),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      actionFunc: "rangeReplaceAll",
    });
    expect(priorAction).toHaveBeenCalledOnce();
    expect(h.replaceAll).not.toHaveBeenCalled();
  });
});
