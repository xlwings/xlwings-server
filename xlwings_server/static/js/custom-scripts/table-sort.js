function sortError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createTableSort(getTable) {
  return async function tableSort(context, action) {
    const [tableIndex, keys, ascending] = action.args ?? [];
    if (
      !Number.isSafeInteger(tableIndex) ||
      tableIndex < 0 ||
      !Array.isArray(keys) ||
      keys.length === 0 ||
      !Array.isArray(ascending) ||
      ascending.length !== keys.length ||
      keys.some((key) => !Number.isSafeInteger(key) || key < 1) ||
      new Set(keys).size !== keys.length ||
      ascending.some((direction) => typeof direction !== "boolean")
    ) {
      throw sortError("Invalid table sort arguments", "invalid_table_sort");
    }

    const table = await getTable(context, action);
    if (!table) {
      throw sortError("Table not found", "table_not_found");
    }
    table.load("showHeaders");
    await context.sync();
    const fields = keys.map((key, index) => ({
      key: key - 1,
      ascending: ascending[index],
      sortOn: "Value",
    }));
    if (table.showHeaders) {
      // Excel's table sort keeps the header and totals rows in place and
      // stores the sort state on the table.
      table.sort.apply(fields, false);
    } else {
      // The table sort fails with ItemNotFound while the header row is
      // hidden, so sort the data body instead, as the desktop engines do.
      table.getDataBodyRange().sort.apply(fields, false, false, "Rows");
    }
    await context.sync();
  };
}
