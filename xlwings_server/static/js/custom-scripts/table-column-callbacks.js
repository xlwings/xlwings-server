import { unqualifiedAddress } from "./workbook-metadata.js";

function columnError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireVersion(isSupported, version) {
  if (!isSupported("ExcelApi", version)) {
    throw columnError(
      "unsupported_table_columns",
      `This table column operation requires ExcelApi ${version} on this Excel host.`,
    );
  }
}

async function requireUnprotectedSheet(context, sheet) {
  sheet.protection.load("protected");
  await context.sync();
  if (sheet.protection.protected) {
    throw columnError(
      "protected_table_sheet",
      "The table's worksheet is protected.",
    );
  }
}

async function readTable(run, sheetName, tableIndex, reader) {
  return run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const tables = sheet.tables.load("items");
    await context.sync();
    if (
      !Number.isSafeInteger(tableIndex) ||
      tableIndex < 0 ||
      tableIndex >= tables.items.length
    ) {
      throw columnError("missing_table", "Table no longer exists.");
    }
    return reader(context, tables.items[tableIndex]);
  });
}

export function createAddTableColumn(getSheet, getTable, isSupported) {
  return async function addTableColumn(context, action) {
    requireVersion(isSupported, "1.4");
    const [tableIndex, index, name] = action?.args ?? [];
    if (!Number.isSafeInteger(tableIndex) || tableIndex < 0) {
      throw columnError("missing_table", "Invalid table index.");
    }
    if (typeof name !== "string" || !name.trim()) {
      throw columnError(
        "invalid_table_column_name",
        "Table column name must not be empty.",
      );
    }
    const sheet = await getSheet(context, action);
    const table = await getTable(context, action);
    if (!table) throw columnError("missing_table", "Table no longer exists.");
    const columns = table.columns.load("items/name");
    await context.sync();
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index > columns.items.length
    ) {
      throw columnError(
        "invalid_table_column_index",
        "Table column index is out of range.",
      );
    }
    if (
      columns.items.some(
        (column) => column.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw columnError(
        "duplicate_table_column",
        `Table column ${name} already exists.`,
      );
    }
    await requireUnprotectedSheet(context, sheet);
    columns.add(index, null, name);
    await context.sync();
  };
}

export function createDeleteTableColumn(getSheet, getTable, isSupported) {
  return async function deleteTableColumn(context, action) {
    requireVersion(isSupported, "1.2");
    const [tableIndex, name] = action?.args ?? [];
    if (!Number.isSafeInteger(tableIndex) || tableIndex < 0) {
      throw columnError("missing_table", "Invalid table index.");
    }
    const sheet = await getSheet(context, action);
    const table = await getTable(context, action);
    if (!table) throw columnError("missing_table", "Table no longer exists.");
    const columns = table.columns.load("items/name");
    await context.sync();
    if (columns.items.length === 1) {
      throw columnError(
        "last_table_column",
        "Cannot delete the last table column.",
      );
    }
    if (!columns.items.some((column) => column.name === name)) {
      throw columnError(
        "missing_table_column",
        `Table column ${name} no longer exists.`,
      );
    }
    await requireUnprotectedSheet(context, sheet);
    columns.getItem(name).delete();
    await context.sync();
  };
}

export function createGetTableColumnCount(run) {
  return (sheetName, tableIndex) =>
    readTable(run, sheetName, tableIndex, async (context, table) => {
      const columns = table.columns.load("count");
      await context.sync();
      return columns.count;
    });
}

export function createGetTableColumnRangeAddress(run) {
  return (sheetName, tableIndex, name, dataBody = false) =>
    readTable(run, sheetName, tableIndex, async (context, table) => {
      const columns = table.columns.load("items/name");
      const rows = table.rows.load("count");
      await context.sync();
      if (!columns.items.some((column) => column.name === name)) {
        throw columnError(
          "missing_table_column",
          `Table column ${name} no longer exists.`,
        );
      }
      if (dataBody && rows.count === 0) return null;
      const column = columns.getItem(name);
      const range = (
        dataBody ? column.getDataBodyRange() : column.getRange()
      ).load("address");
      await context.sync();
      return unqualifiedAddress(range);
    });
}
