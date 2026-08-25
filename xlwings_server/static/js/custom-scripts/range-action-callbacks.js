export function createSetFormula(getRange) {
  return async function setFormula(context, action) {
    const range = await getRange(context, action);
    // The remote Python protocol has always named the formula matrix `values`.
    range.formulas = action.values;
    await context.sync();
  };
}
