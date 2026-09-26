import { describe, expect, it, vi } from "vitest";

import {
  createAddTable,
  createAddTableRow,
  createDeleteTableRow,
  createGetTableRowCount,
  createGetTableRowRangeAddress,
} from "../../xlwings_server/static/js/custom-scripts/table-action-callbacks.js";

describe("addTable action callback", () => {
  it("uses the shared sheet resolver and applies optional table metadata", async () => {
    const table = {};
    const sheet = {
      tables: {
        add: vi.fn(() => table),
      },
    };
    const getSheet = vi.fn(async () => sheet);
    const addTable = createAddTable(getSheet);
    const context = {};
    const action = {
      sheet_position: 7,
      args: ["A1:E5", true, "TableStyleMedium2", "RandomData"],
    };

    await addTable(context, action);

    expect(getSheet).toHaveBeenCalledWith(context, action);
    expect(sheet.tables.add).toHaveBeenCalledWith("A1:E5", true);
    expect(table).toEqual({
      style: "TableStyleMedium2",
      name: "RandomData",
    });
  });

  it("preserves generated defaults when style and name are omitted", async () => {
    const table = {};
    const sheet = { tables: { add: vi.fn(() => table) } };
    const addTable = createAddTable(async () => sheet);

    await addTable({}, { args: ["A1:B2", false, null, null] });

    expect(sheet.tables.add).toHaveBeenCalledWith("A1:B2", false);
    expect(table).toEqual({});
  });
});

function rowFixture({
  occupiedBelow = false,
  protectedSheet = false,
  count = 2,
} = {}) {
  const row = {
    delete: vi.fn(),
    getRange: vi.fn(() => ({
      address: "S!B3:C3",
      load() {
        return this;
      },
    })),
  };
  const rows = {
    count,
    load() {
      return this;
    },
    add: vi.fn(),
    getItemAt: vi.fn(() => row),
  };
  const tableRange = {
    rowIndex: 0,
    columnIndex: 1,
    rowCount: 3,
    columnCount: 2,
    load() {
      return this;
    },
  };
  const table = { rows, getRange: vi.fn(() => tableRange) };
  const used = {
    rowIndex: 0,
    rowCount: occupiedBelow ? 5 : 3,
    isNullObject: false,
    load() {
      return this;
    },
  };
  const below = {
    isNullObject: !occupiedBelow,
    load() {
      return this;
    },
  };
  const sheet = {
    protection: {
      protected: protectedSheet,
      load() {
        return this;
      },
    },
    getUsedRangeOrNullObject: vi.fn(() => used),
    getRangeByIndexes: vi.fn(() => ({ getUsedRangeOrNullObject: () => below })),
  };
  const context = { sync: vi.fn(async () => {}) };
  return { row, rows, table, sheet, context };
}

describe("table row actions", () => {
  const supported = () => true;

  it("appends and inserts a single row with native table operations", async () => {
    const fixture = rowFixture();
    const add = createAddTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    await add(fixture.context, { args: [0, 2, ["new", 7]] });
    await add(fixture.context, { args: [0, 0, null] });
    expect(fixture.rows.add).toHaveBeenNthCalledWith(1, 2, [["new", 7]], false);
    expect(fixture.rows.add).toHaveBeenNthCalledWith(2, 0, undefined, false);
  });

  it("rejects occupied or formatted cells below before changing the table", async () => {
    const fixture = rowFixture({ occupiedBelow: true });
    const add = createAddTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    const remove = createDeleteTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    await expect(
      add(fixture.context, { args: [0, 2, null] }),
    ).rejects.toMatchObject({ code: "table_row_neighbor_cells" });
    await expect(
      remove(fixture.context, { args: [0, 0] }),
    ).rejects.toMatchObject({ code: "table_row_neighbor_cells" });
    expect(fixture.rows.add).not.toHaveBeenCalled();
    expect(fixture.row.delete).not.toHaveBeenCalled();
  });

  it("rejects protected sheets, invalid shape, and unsupported hosts before mutation", async () => {
    const fixture = rowFixture({ protectedSheet: true });
    const add = createAddTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    await expect(
      add(fixture.context, { args: [0, 2, null] }),
    ).rejects.toMatchObject({ code: "protected_table_sheet" });
    await expect(
      add(fixture.context, { args: [0, 2, [1]] }),
    ).rejects.toMatchObject({ code: "invalid_table_row_values" });
    const unsupported = createAddTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      () => false,
    );
    await expect(
      unsupported(fixture.context, { args: [0, 2, null] }),
    ).rejects.toMatchObject({ code: "unsupported_table_rows" });
    expect(fixture.rows.add).not.toHaveBeenCalled();
  });

  it("deletes the selected data row", async () => {
    const fixture = rowFixture();
    const remove = createDeleteTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    await remove(fixture.context, { args: [0, 1] });
    expect(fixture.rows.getItemAt).toHaveBeenCalledWith(1);
    expect(fixture.row.delete).toHaveBeenCalledOnce();
  });

  it("adds to an empty table and rejects deletion of a missing row", async () => {
    const fixture = rowFixture({ count: 0 });
    const add = createAddTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    const remove = createDeleteTableRow(
      async () => fixture.sheet,
      async () => fixture.table,
      supported,
    );
    await add(fixture.context, { args: [0, 0, ["only", 1]] });
    expect(fixture.rows.add).toHaveBeenCalledWith(0, [["only", 1]], false);
    await expect(
      remove(fixture.context, { args: [0, 0] }),
    ).rejects.toMatchObject({
      code: "invalid_table_row_index",
    });
  });

  it("reads live count and row address, and rejects missing rows", async () => {
    const fixture = rowFixture();
    const run = async (callback) =>
      callback({
        workbook: {
          worksheets: {
            getItem: () => ({
              tables: { load: () => ({ items: [fixture.table] }) },
            }),
          },
        },
        sync: fixture.context.sync,
      });
    expect(await createGetTableRowCount(run)("S", 0)).toBe(2);
    expect(await createGetTableRowRangeAddress(run)("S", 0, 1)).toBe("B3:C3");
    await expect(
      createGetTableRowRangeAddress(run)("S", 0, 2),
    ).rejects.toMatchObject({ code: "invalid_table_row_index" });
    await expect(createGetTableRowCount(run)("S", 1)).rejects.toMatchObject({
      code: "missing_table",
    });
  });
});
