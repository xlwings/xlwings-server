import { unqualifiedAddress } from "./workbook-metadata.js";

function rangeSearchError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireSearchSupport(isSupported) {
  if (!isSupported("ExcelApi", "1.9")) {
    throw rangeSearchError(
      "Range search and replacement require ExcelApi 1.9 on this Excel host.",
      "unsupported_range_search",
    );
  }
}

function validateFind(text, whole, direction, order, matchCase) {
  if (
    typeof text !== "string" ||
    text.length === 0 ||
    typeof whole !== "boolean" ||
    !["forward", "backward"].includes(direction) ||
    !["rows", "columns"].includes(order) ||
    typeof matchCase !== "boolean"
  ) {
    throw rangeSearchError(
      "Invalid range find arguments",
      "invalid_range_find",
    );
  }
}

function foundAddress(found) {
  return found.isNullObject ? null : unqualifiedAddress(found);
}

export function createFindRange(run, isSupported) {
  return async function findRange(
    sheetName,
    address,
    text,
    whole,
    direction,
    order,
    matchCase,
  ) {
    validateFind(text, whole, direction, order, matchCase);
    requireSearchSupport(isSupported);
    try {
      return await run(async (context) => {
        const sheet = context.workbook.worksheets.getItem(sheetName);
        const range = sheet
          .getRange(address)
          .load("address,rowIndex,columnIndex,rowCount,columnCount");
        await context.sync();

        const criteria = {
          completeMatch: whole,
          matchCase,
          searchDirection: direction === "forward" ? "Forward" : "Backwards",
        };
        const search = async (target, searchCriteria = criteria) => {
          const found = target
            .findOrNullObject(text, searchCriteria)
            .load("address");
          await context.sync();
          return foundAddress(found);
        };

        // Office.js searches the entire worksheet when findOrNullObject is called
        // on one cell. Search a two-cell range with the requested cell first,
        // then discard a result in the neighbor.
        if (range.rowCount === 1 && range.columnCount === 1) {
          const hasRightNeighbor = range.columnIndex < 16383;
          const probe = sheet.getRangeByIndexes(
            range.rowIndex,
            hasRightNeighbor ? range.columnIndex : range.columnIndex - 1,
            1,
            2,
          );
          const candidate = await search(probe, {
            ...criteria,
            searchDirection: hasRightNeighbor ? "Forward" : "Backwards",
          });
          return candidate?.replaceAll("$", "").toUpperCase() ===
            unqualifiedAddress(range).replaceAll("$", "").toUpperCase()
            ? candidate
            : null;
        }

        // A one-dimensional range has the same traversal under both orders.
        if (range.rowCount === 1 || range.columnCount === 1) {
          return search(range);
        }

        // Office.js exposes direction but no search-order option. First establish
        // that a match exists; then bisect the requested rows or columns until
        // only one remains. Native search within that final strip gives the first
        // cell in either direction. At most 20 narrowing syncs are needed for
        // Excel's maximum row count.
        if ((await search(range)) === null) return null;
        let row = range.rowIndex;
        let column = range.columnIndex;
        let rows = range.rowCount;
        let columns = range.columnCount;
        const byRows = order === "rows";
        const forward = direction === "forward";
        while ((byRows ? rows : columns) > 1) {
          const size = Math.floor((byRows ? rows : columns) / 2);
          const firstRow = byRows && !forward ? row + rows - size : row;
          const firstColumn =
            !byRows && !forward ? column + columns - size : column;
          const first = sheet.getRangeByIndexes(
            firstRow,
            firstColumn,
            byRows ? size : rows,
            byRows ? columns : size,
          );
          if ((await search(first)) !== null) {
            row = firstRow;
            column = firstColumn;
            if (byRows) rows = size;
            else columns = size;
          } else if (byRows) {
            if (forward) row += size;
            rows -= size;
          } else {
            if (forward) column += size;
            columns -= size;
          }
        }
        return search(sheet.getRangeByIndexes(row, column, rows, columns));
      });
    } catch (cause) {
      const error = rangeSearchError(
        `Range.find() failed: ${cause?.message || String(cause)}`,
        "range_find_failed",
      );
      error.cause = cause;
      throw error;
    }
  };
}

export function createRangeReplaceAll(getRange, isSupported) {
  return async function rangeReplaceAll(context, action) {
    const [old, replacement, whole, matchCase] = action.args ?? [];
    if (
      !Array.isArray(action.args) ||
      action.args.length !== 4 ||
      typeof old !== "string" ||
      old.length === 0 ||
      typeof replacement !== "string" ||
      typeof whole !== "boolean" ||
      typeof matchCase !== "boolean"
    ) {
      throw rangeSearchError(
        "Invalid range replacement arguments",
        "invalid_range_replace",
      );
    }
    requireSearchSupport(isSupported);
    const range = await getRange(context, action);
    range.replaceAll(old, replacement, {
      completeMatch: whole,
      matchCase,
    });
    await context.sync();
  };
}
