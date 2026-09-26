import { unqualifiedAddress } from "./workbook-metadata.js";

export function createAddTable(getSheet) {
  return async function addTable(context, action) {
    const sheet = await getSheet(context, action);
    const table = sheet.tables.add(
      action.args[0].toString(),
      Boolean(action.args[1]),
    );
    if (action.args[2] != null) {
      table.style = action.args[2].toString();
    }
    if (action.args[3] != null) {
      table.name = action.args[3].toString();
    }
  };
}

function tableRowError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireTableRows(isSupported, version) {
  if (!isSupported("ExcelApi", version)) {
    throw tableRowError(
      "unsupported_table_rows",
      `This table row operation requires ExcelApi ${version} on this Excel host.`,
    );
  }
}

async function requireSafeBelow(context, sheet, table, checkAllBelow) {
  const tableRange = table
    .getRange()
    .load("rowIndex,columnIndex,rowCount,columnCount");
  const used = sheet.getUsedRangeOrNullObject(false).load("rowIndex,rowCount");
  sheet.protection.load("protected");
  await context.sync();
  if (sheet.protection.protected) {
    throw tableRowError(
      "protected_table_sheet",
      "The table's worksheet is protected.",
    );
  }
  const bottom = tableRange.rowIndex + tableRange.rowCount;
  if (bottom >= 1048576) {
    if (checkAllBelow) return;
    throw tableRowError(
      "table_row_no_space",
      "The table reaches the last worksheet row.",
    );
  }
  if (used.isNullObject || used.rowIndex + used.rowCount <= bottom) return;
  const last = checkAllBelow ? used.rowIndex + used.rowCount : bottom + 1;
  const below = sheet
    .getRangeByIndexes(
      bottom,
      tableRange.columnIndex,
      last - bottom,
      tableRange.columnCount,
    )
    .getUsedRangeOrNullObject(false);
  below.load("address");
  await context.sync();
  if (!below.isNullObject) {
    throw tableRowError(
      "table_row_neighbor_cells",
      "Cells or formatting below the table would move or be consumed.",
    );
  }
}

function checkedIndex(value, count, allowEnd) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= count + Number(allowEnd)
  ) {
    throw tableRowError(
      "invalid_table_row_index",
      "Table row index is out of range.",
    );
  }
}

export function createAddTableRow(getSheet, getTable, isSupported) {
  return async function addTableRow(context, action) {
    requireTableRows(isSupported, "1.15");
    const [tableIndex, index, values] = action?.args ?? [];
    if (!Number.isSafeInteger(tableIndex) || tableIndex < 0) {
      throw tableRowError("invalid_table_row", "Invalid table index.");
    }
    const sheet = await getSheet(context, action);
    const table = await getTable(context, action);
    if (!table) throw tableRowError("missing_table", "Table no longer exists.");
    const rows = table.rows.load("count");
    const tableRange = table.getRange().load("columnCount");
    await context.sync();
    checkedIndex(index, rows.count, true);
    if (
      values !== null &&
      (!Array.isArray(values) ||
        values.length !== tableRange.columnCount ||
        values.some(
          (value) =>
            value !== null &&
            typeof value !== "string" &&
            typeof value !== "boolean" &&
            !(typeof value === "number" && Number.isFinite(value)),
        ))
    ) {
      throw tableRowError(
        "invalid_table_row_values",
        "Invalid table row values.",
      );
    }
    await requireSafeBelow(context, sheet, table, false);
    rows.add(index, values === null ? undefined : [values], false);
    await context.sync();
  };
}

export function createDeleteTableRow(getSheet, getTable, isSupported) {
  return async function deleteTableRow(context, action) {
    requireTableRows(isSupported, "1.4");
    const [tableIndex, index] = action?.args ?? [];
    if (!Number.isSafeInteger(tableIndex) || tableIndex < 0) {
      throw tableRowError("invalid_table_row", "Invalid table index.");
    }
    const sheet = await getSheet(context, action);
    const table = await getTable(context, action);
    if (!table) throw tableRowError("missing_table", "Table no longer exists.");
    const rows = table.rows.load("count");
    await context.sync();
    checkedIndex(index, rows.count, false);
    await requireSafeBelow(context, sheet, table, true);
    rows.getItemAt(index).delete();
    await context.sync();
  };
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
      throw tableRowError("missing_table", "Table no longer exists.");
    }
    return reader(context, tables.items[tableIndex]);
  });
}

export function createGetTableRowCount(run) {
  return (sheetName, tableIndex) =>
    readTable(run, sheetName, tableIndex, async (context, table) => {
      const rows = table.rows.load("count");
      await context.sync();
      return rows.count;
    });
}

export function createGetTableRowRangeAddress(run) {
  return (sheetName, tableIndex, index) =>
    readTable(run, sheetName, tableIndex, async (context, table) => {
      const rows = table.rows.load("count");
      await context.sync();
      checkedIndex(index, rows.count, false);
      const range = rows.getItemAt(index).getRange().load("address");
      await context.sync();
      return unqualifiedAddress(range);
    });
}
