export function createAddChart(getSheet, getSelectedRangeAddress) {
  return async function addChart(context, action) {
    // Adding a chart leaves it selected, which steals the user's selection.
    // Capture it first and restore it afterwards, as addPicture() does.
    const selectedAddress = getSelectedRangeAddress
      ? await getSelectedRangeAddress(context)
      : null;

    const sheet = await getSheet(context, action);
    const sourceSheet = context.workbook.worksheets.getItem(
      action.args[2].toString(),
    );
    const chart = sheet.charts.add(
      action.args[1].toString(),
      sourceSheet.getRange(action.args[3].toString()),
    );
    // left/top are points, like xlwings' geometry. Chart.setPosition() takes
    // *cells* (a start and end cell reference), so it can't be used here --
    // passing points to it makes Excel reject the whole action batch.
    if (action.args[4] != null) chart.left = Number(action.args[4]);
    if (action.args[5] != null) chart.top = Number(action.args[5]);
    if (action.args[6] != null) chart.width = Number(action.args[6]);
    if (action.args[7] != null) chart.height = Number(action.args[7]);
    chart.name = action.args[0].toString();

    if (selectedAddress) {
      context.workbook.worksheets
        .getActiveWorksheet()
        .getRange(selectedAddress)
        .select();
      await context.sync();
    }
  };
}
