import { isHexColor, normalizeFillColor } from "./workbook-metadata.js";

const MAX_COLOR_CELLS = 100_000;
// setCellProperties sends one nested property object per cell, so writes use a
// smaller bound than the compact color matrix returned by getCellProperties.
const MAX_SET_COLOR_CELLS = 10_000;

function readError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function checkColorsSupport(method = "get_colors") {
  if (!Office.context.requirements.isSetSupported("ExcelApi", "1.9")) {
    throw readError(
      "unsupported_host",
      `Range.${method}() requires ExcelApi 1.9.`,
    );
  }
}

export function createSetRangeColors(getRange) {
  return async function setRangeColors(context, action) {
    checkColorsSupport("set_colors");
    const { row_count: rows, column_count: columns } = action;
    if (
      !Number.isSafeInteger(rows) ||
      !Number.isSafeInteger(columns) ||
      rows < 1 ||
      columns < 1
    ) {
      throw readError(
        "invalid_colors",
        "Invalid set_colors() range dimensions.",
      );
    }
    if (rows * columns > MAX_SET_COLOR_CELLS) {
      throw readError(
        "range_too_large",
        `Range.set_colors() supports at most ${MAX_SET_COLOR_CELLS} cells per call.`,
      );
    }
    const colors = action.args?.[0];
    if (
      !Array.isArray(colors) ||
      colors.length !== rows ||
      colors.some((row) => !Array.isArray(row) || row.length !== columns)
    ) {
      throw readError(
        "invalid_colors",
        "set_colors() matrix shape does not match the range.",
      );
    }
    const properties = colors.map((row) =>
      row.map((color) => {
        if (color === "keep") return {};
        if (color == null) return { format: { fill: { pattern: "None" } } };
        if (isHexColor(color)) {
          return { format: { fill: { color } } };
        }
        throw readError(
          "invalid_colors",
          "set_colors() contains an invalid color.",
        );
      }),
    );
    const range = await getRange(context, action);
    range.setCellProperties(properties);
    await context.sync();
  };
}

// rowCount and columnCount must already have been loaded and synchronized.
export async function readRangeColors(context, range) {
  const { rowCount, columnCount } = range;
  if (rowCount * columnCount > MAX_COLOR_CELLS) {
    throw readError(
      "range_too_large",
      `Range.get_colors() supports at most ${MAX_COLOR_CELLS} cells per call; read smaller ranges.`,
    );
  }
  const properties = range.getCellProperties({
    format: { fill: { color: true, pattern: true } },
  });
  await context.sync();
  const cells = properties.value;
  if (
    !Array.isArray(cells) ||
    cells.length !== rowCount ||
    cells.some((row) => !Array.isArray(row) || row.length !== columnCount)
  ) {
    throw readError(
      "invalid_response",
      "Incomplete cell properties in get_colors() response.",
    );
  }
  // Resolve each distinct color once per response, rather than creating a
  // canvas for every cell when Office reports repeated named colors.
  const normalizedColors = new Map();
  return cells.map((row) =>
    row.map((cell) => {
      const fill = cell?.format?.fill;
      if (!fill) {
        throw readError(
          "invalid_response",
          "Missing cell fill in get_colors() response.",
        );
      }
      // No fill may still carry a default color such as white. Test the pattern
      // first so that it remains distinct from an explicitly white solid fill.
      if (fill.pattern === "None" || fill.color === "" || fill.color == null)
        return null;
      if (!normalizedColors.has(fill.color)) {
        normalizedColors.set(fill.color, normalizeFillColor(fill.color));
      }
      const color = normalizedColors.get(fill.color);
      if (!color) {
        throw readError(
          "invalid_response",
          "Invalid cell fill color in get_colors() response.",
        );
      }
      return color;
    }),
  );
}
