export function createSetFormula(getRange) {
  return async function setFormula(context, action) {
    const range = await getRange(context, action);
    // The remote Python protocol has always named the formula matrix `values`.
    range.formulas = action.values;
    await context.sync();
  };
}

export function createSetFormulaArray(getRange, isSetSupported) {
  return async function setFormulaArray(context, action) {
    if (!isSetSupported("ExcelApiDesktop", "1.1")) {
      throw new Error(
        "formula_array requires ExcelApiDesktop 1.1 and isn't supported by this Excel host.",
      );
    }
    const range = await getRange(context, action);
    range.formulaArray = action.args[0].toString();
    await context.sync();
  };
}

export function columnWidthCharactersToPoints(
  characters,
  standardCharacters,
  standardPoints,
) {
  if (!Number.isFinite(characters) || characters < 0 || characters > 255) {
    throw new Error("column_width must be a number between 0 and 255.");
  }
  if (characters === 0) return 0;

  // Excel stores column widths in Normal-style character units, while
  // RangeFormat.columnWidth uses points. Infer the workbook's maximum digit
  // width from its standard width instead of assuming a particular font.
  const pointsPerPixel = 72 / 96;
  const standardPixels = standardPoints / pointsPerPixel;
  const inferredDigitWidth =
    (standardPixels - 5) / Math.max(standardCharacters, Number.EPSILON);
  const digitWidth =
    Number.isFinite(inferredDigitWidth) && inferredDigitWidth > 0
      ? inferredDigitWidth
      : 7;
  const pixels =
    characters < 1
      ? characters * (digitWidth + 5)
      : characters * digitWidth + 5;
  return pixels * pointsPerPixel;
}

export function createSetColumnWidth(getRange) {
  return async function setColumnWidth(context, action) {
    const characters = action.args[0];
    if (!Number.isFinite(characters) || characters < 0 || characters > 255) {
      throw new Error("column_width must be a number between 0 and 255.");
    }
    const range = await getRange(context, action);
    const sheet = range.worksheet;

    // Resetting the target to the standard width is safe because this action
    // immediately replaces its width, and lets us measure the workbook's real
    // Normal-style character width without hard-coding Calibri/Aptos metrics.
    range.format.useStandardWidth = true;
    range.format.load("columnWidth");
    sheet.load("standardWidth");
    await context.sync();

    range.format.columnWidth = columnWidthCharactersToPoints(
      characters,
      sheet.standardWidth,
      range.format.columnWidth,
    );
    await context.sync();
  };
}
