import { unqualifiedAddress } from "./workbook-metadata.js";

function pivotReadError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createGetPivotTableRangeAddress(run, isSupported) {
  return async function getPivotTableRangeAddress(
    sheetName,
    pivotIndex,
    pivotId,
    kind,
  ) {
    if (
      typeof sheetName !== "string" ||
      !sheetName ||
      !Number.isInteger(pivotIndex) ||
      pivotIndex < 0 ||
      !["report", "data_body"].includes(kind)
    ) {
      throw pivotReadError(
        "invalid_pivot_table_read",
        "Invalid PivotTable range read arguments",
      );
    }
    if (!isSupported("ExcelApi", "1.8")) {
      throw pivotReadError(
        "unsupported_pivot_table",
        "PivotTable range reads require ExcelApi 1.8 on this Excel host.",
      );
    }

    return run(async (context) => {
      const sheet = context.workbook.worksheets.getItem(sheetName);
      const pivots = sheet.pivotTables.load("items/id");
      await context.sync();
      // The ID guards against selecting a different PivotTable when Excel's
      // collection order changes after the Python metadata was loaded.
      const pivot =
        pivotId == null
          ? pivots.items[pivotIndex]
          : pivots.items.find((item) => item.id === pivotId);
      if (!pivot) {
        throw pivotReadError(
          "pivot_table_not_found",
          `PivotTable at index ${pivotIndex} on sheet ${sheetName} no longer exists.`,
        );
      }

      if (kind === "data_body") {
        const values = pivot.dataHierarchies.load("items");
        await context.sync();
        if (values.items.length === 0) return null;
      }
      const range =
        kind === "report"
          ? pivot.layout.getRange().load("address")
          : pivot.layout.getDataBodyRange().load("address");
      await context.sync();
      return unqualifiedAddress(range);
    });
  };
}
