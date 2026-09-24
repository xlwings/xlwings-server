function sortError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createRangeSort(getSheet) {
  return async function rangeSort(context, action) {
    const [keys, ascending, hasHeaders] = action.args ?? [];
    if (
      !Array.isArray(keys) ||
      keys.length === 0 ||
      !Array.isArray(ascending) ||
      ascending.length !== keys.length ||
      typeof hasHeaders !== "boolean" ||
      !Number.isSafeInteger(action.start_row) ||
      !Number.isSafeInteger(action.start_column) ||
      !Number.isSafeInteger(action.row_count) ||
      !Number.isSafeInteger(action.column_count) ||
      action.start_row < 0 ||
      action.start_column < 0 ||
      action.row_count < (hasHeaders ? 2 : 1) ||
      action.column_count < 1 ||
      keys.some(
        (key) =>
          !Number.isSafeInteger(key) || key < 1 || key > action.column_count,
      ) ||
      new Set(keys).size !== keys.length ||
      ascending.some((direction) => typeof direction !== "boolean")
    ) {
      throw sortError("Invalid range sort arguments", "invalid_range_sort");
    }

    const sheet = await getSheet(context, action);
    const tables = sheet.tables.load("items");
    await context.sync();
    const tableRanges = tables.items.map((table) =>
      table.getRange().load("rowIndex,columnIndex,rowCount,columnCount"),
    );
    await context.sync();
    const bottom = action.start_row + action.row_count;
    const right = action.start_column + action.column_count;
    if (
      tableRanges.some(
        (table) =>
          action.start_row < table.rowIndex + table.rowCount &&
          table.rowIndex < bottom &&
          action.start_column < table.columnIndex + table.columnCount &&
          table.columnIndex < right,
      )
    ) {
      throw sortError(
        "Range.sort() does not support ranges intersecting a table",
        "sort_table_range",
      );
    }

    const range = sheet.getRangeByIndexes(
      action.start_row,
      action.start_column,
      action.row_count,
      action.column_count,
    );
    range.sort.apply(
      keys.map((key, index) => ({
        key: key - 1,
        ascending: ascending[index],
        sortOn: "Value",
      })),
      false,
      hasHeaders,
      "Rows",
    );
    await context.sync();
  };
}
