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

export function createSetColumnWidth(getRange) {
  return async function setColumnWidth(context, action) {
    // Points, which is what Office.js' RangeFormat.columnWidth takes. The
    // desktop engines pass COM's raw value through the same way; there it
    // happens to be characters.
    const points = action.args[0];
    if (!Number.isFinite(points) || points < 0) {
      throw new Error("column_width must be a non-negative number.");
    }
    const range = await getRange(context, action);
    range.format.columnWidth = points;
    await context.sync();
  };
}
