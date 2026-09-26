import { describe, expect, it, vi } from "vitest";

import {
  createAddTableColumn,
  createDeleteTableColumn,
  createGetTableColumnCount,
  createGetTableColumnRangeAddress,
} from "../../xlwings_server/static/js/custom-scripts/table-column-callbacks.js";

function fixture({
  protectedSheet = false,
  occupiedRight = false,
  names = ["Item", "Amount"],
} = {}) {
  const column = {
    delete: vi.fn(),
    getRange: vi.fn(() => ({
      address: "S!C2:C4",
      load() {
        return this;
      },
    })),
    getDataBodyRange: vi.fn(() => ({
      address: "S!C3:C4",
      load() {
        return this;
      },
    })),
  };
  const columns = {
    count: names.length,
    items: names.map((name) => ({ name })),
    load() {
      return this;
    },
    add: vi.fn(),
    getItem: vi.fn(() => column),
  };
  const rows = {
    count: 2,
    load() {
      return this;
    },
  };
  const table = {
    columns,
    rows,
    getRange: vi.fn(() => ({
      rowIndex: 1,
      rowCount: 3,
      columnIndex: 1,
      columnCount: 2,
      load() {
        return this;
      },
    })),
  };
  const neighbor = {
    isNullObject: !occupiedRight,
    load() {
      return this;
    },
  };
  const sheet = {
    tables: {
      items: [table],
      load() {
        return this;
      },
    },
    protection: {
      protected: protectedSheet,
      load() {
        return this;
      },
    },
    getUsedRangeOrNullObject: vi.fn(() => ({
      isNullObject: false,
      columnIndex: 1,
      columnCount: occupiedRight ? 4 : 2,
      load() {
        return this;
      },
    })),
    getRangeByIndexes: vi.fn(() => ({
      getUsedRangeOrNullObject: () => neighbor,
    })),
  };
  const context = {
    sync: vi.fn(async () => {}),
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
  };
  return { column, columns, table, sheet, context };
}

describe("table column actions", () => {
  it("inserts by zero-based wire position with a name and preserves neighboring cells", async () => {
    const f = fixture();
    const add = createAddTableColumn(
      async () => f.sheet,
      async () => f.table,
      () => true,
    );
    await add(f.context, { args: [0, 1, "Margin"] });
    expect(f.columns.add).toHaveBeenCalledWith(1, null, "Margin");
    expect(f.context.sync).toHaveBeenCalled();
  });

  it("rejects occupied or formatted cells to the right before changing the table", async () => {
    const f = fixture({ occupiedRight: true });
    const add = createAddTableColumn(
      async () => f.sheet,
      async () => f.table,
      () => true,
    );
    await expect(
      add(f.context, { args: [0, 2, "Margin"] }),
    ).rejects.toMatchObject({
      code: "table_column_neighbor_cells",
    });
    expect(f.columns.add).not.toHaveBeenCalled();
  });

  it("rejects protected sheets, invalid positions and unsupported hosts", async () => {
    const f = fixture({ protectedSheet: true });
    const add = createAddTableColumn(
      async () => f.sheet,
      async () => f.table,
      () => true,
    );
    await expect(
      add(f.context, { args: [0, 2, "Margin"] }),
    ).rejects.toMatchObject({
      code: "protected_table_sheet",
    });
    await expect(
      add(f.context, { args: [0, 3, "Margin"] }),
    ).rejects.toMatchObject({
      code: "invalid_table_column_index",
    });
    const unsupported = createAddTableColumn(
      async () => f.sheet,
      async () => f.table,
      () => false,
    );
    await expect(
      unsupported(f.context, { args: [0, 1, "Margin"] }),
    ).rejects.toMatchObject({
      code: "unsupported_table_columns",
    });
    expect(f.columns.add).not.toHaveBeenCalled();
  });

  it("deletes only the selected table column and rejects the last column", async () => {
    const f = fixture();
    const remove = createDeleteTableColumn(
      async () => f.sheet,
      async () => f.table,
      () => true,
    );
    await remove(f.context, { args: [0, "Amount"] });
    expect(f.columns.getItem).toHaveBeenCalledWith("Amount");
    expect(f.column.delete).toHaveBeenCalledOnce();
    const single = fixture({ names: ["Only"] });
    const removeLast = createDeleteTableColumn(
      async () => single.sheet,
      async () => single.table,
      () => true,
    );
    await expect(
      removeLast(single.context, { args: [0, "Only"] }),
    ).rejects.toMatchObject({
      code: "last_table_column",
    });
    expect(single.column.delete).not.toHaveBeenCalled();
  });

  it("rejects deletion on protected sheets and missing tables without a mutation", async () => {
    const protectedFixture = fixture({ protectedSheet: true });
    const remove = createDeleteTableColumn(
      async () => protectedFixture.sheet,
      async () => protectedFixture.table,
      () => true,
    );
    await expect(
      remove(protectedFixture.context, { args: [0, "Amount"] }),
    ).rejects.toMatchObject({ code: "protected_table_sheet" });
    expect(protectedFixture.column.delete).not.toHaveBeenCalled();

    const missing = createAddTableColumn(
      async () => protectedFixture.sheet,
      async () => undefined,
      () => true,
    );
    await expect(
      missing(protectedFixture.context, { args: [0, 1, "Margin"] }),
    ).rejects.toMatchObject({ code: "missing_table" });
  });
});

describe("table column reads", () => {
  it("returns the current count and ranges, including no body on an empty table", async () => {
    const f = fixture();
    const run = (callback) => callback(f.context);
    expect(await createGetTableColumnCount(run)("S", 0)).toBe(2);
    expect(await createGetTableColumnRangeAddress(run)("S", 0, "Amount")).toBe(
      "C2:C4",
    );
    expect(
      await createGetTableColumnRangeAddress(run)("S", 0, "Amount", true),
    ).toBe("C3:C4");
    f.table.rows.count = 0;
    expect(
      await createGetTableColumnRangeAddress(run)("S", 0, "Amount", true),
    ).toBeNull();
  });
});
