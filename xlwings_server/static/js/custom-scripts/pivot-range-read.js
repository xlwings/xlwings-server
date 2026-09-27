import { unqualifiedAddress } from "./workbook-metadata.js";
import { selectPivotTable } from "./pivot-identity.js";

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
    pivotName,
    kind,
  ) {
    if (
      typeof sheetName !== "string" ||
      !sheetName ||
      !Number.isInteger(pivotIndex) ||
      pivotIndex < 0 ||
      (pivotId == null && (typeof pivotName !== "string" || !pivotName)) ||
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
      const pivots = sheet.pivotTables.load("items/id,items/name");
      await context.sync();
      const pivot = selectPivotTable(
        pivots.items,
        pivotIndex,
        pivotId,
        pivotName,
      );

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
