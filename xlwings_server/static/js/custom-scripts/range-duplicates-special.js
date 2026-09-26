import { unqualifiedAddress } from "./workbook-metadata.js";

function rangeOperationError(message, code, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function requireSupport(isSupported) {
  if (!isSupported("ExcelApi", "1.9")) {
    throw rangeOperationError(
      "Duplicate removal and special cells require ExcelApi 1.9 on this Excel host.",
      "unsupported_range_operations",
    );
  }
}

export function createRangeRemoveDuplicates(getSheet, isSupported) {
  return async function rangeRemoveDuplicates(context, action) {
    const [columns, hasHeaders] = action?.args ?? [];
    if (
      !Array.isArray(action?.args) ||
      action.args.length !== 2 ||
      !Array.isArray(columns) ||
      columns.length === 0 ||
      typeof hasHeaders !== "boolean" ||
      !Number.isSafeInteger(action.start_row) ||
      !Number.isSafeInteger(action.start_column) ||
      !Number.isSafeInteger(action.row_count) ||
      !Number.isSafeInteger(action.column_count) ||
      action.start_row < 0 ||
      action.start_column < 0 ||
      action.row_count < (hasHeaders ? 2 : 1) ||
      action.column_count < 1 ||
      columns.some(
        (column) =>
          !Number.isSafeInteger(column) ||
          column < 1 ||
          column > action.column_count,
      ) ||
      new Set(columns).size !== columns.length
    ) {
      throw rangeOperationError(
        "Invalid duplicate removal arguments",
        "invalid_range_remove_duplicates",
      );
    }
    requireSupport(isSupported);
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
      throw rangeOperationError(
        "Range.remove_duplicates() does not support ranges intersecting a table",
        "remove_duplicates_table_range",
      );
    }
    sheet
      .getRangeByIndexes(
        action.start_row,
        action.start_column,
        action.row_count,
        action.column_count,
      )
      .removeDuplicates(
        columns.map((column) => column - 1),
        hasHeaders,
      );
    await context.sync();
  };
}

const CELL_TYPES = Object.freeze({
  blanks: "Blanks",
  constants: "Constants",
  formulas: "Formulas",
  visible: "Visible",
});
const VALUE_TYPES = Object.freeze({
  numbers: "Numbers",
  text: "Text",
  logical: "Logical",
  errors: "Errors",
});

export function createGetSpecialCells(run, isSupported) {
  return async function getSpecialCells(
    sheetName,
    address,
    cellType,
    valueType,
  ) {
    if (
      typeof sheetName !== "string" ||
      !sheetName ||
      typeof address !== "string" ||
      !address ||
      !Object.hasOwn(CELL_TYPES, cellType) ||
      (valueType !== null &&
        valueType !== undefined &&
        (!Object.hasOwn(VALUE_TYPES, valueType) ||
          !["constants", "formulas"].includes(cellType)))
    ) {
      throw rangeOperationError(
        "Invalid special cell arguments",
        "invalid_special_cells",
      );
    }
    requireSupport(isSupported);
    try {
      return await run(async (context) => {
        const range = context.workbook.worksheets
          .getItem(sheetName)
          .getRange(address);
        const areas = range
          .getSpecialCellsOrNullObject(
            CELL_TYPES[cellType],
            valueType == null ? undefined : VALUE_TYPES[valueType],
          )
          .load("areas/address");
        await context.sync();
        return areas.isNullObject
          ? []
          : areas.areas.items.map((area) => unqualifiedAddress(area));
      });
    } catch (cause) {
      throw rangeOperationError(
        `Range.get_special_cells() failed: ${cause?.message || String(cause)}`,
        "special_cells_failed",
        cause,
      );
    }
  };
}
