export function createAddChart(getSheet, getSelectedRangeAddress) {
  return async function addChart(context, action) {
    // Adding a chart leaves it selected, which is never what a script wants.
    // Capture the current selection first so it can be put back, as
    // addPicture() does.
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
    await context.sync();

    // getSelectedRange() is workbook-wide, so the captured address belongs to
    // whichever sheet was active -- restoring it onto the chart's sheet would
    // select the wrong cells. Only restore it when the chart landed on the
    // active sheet; otherwise deselect by selecting A1 on the chart's own
    // sheet, which is still better than leaving the chart selected.
    const activeSheet = context.workbook.worksheets.getActiveWorksheet();
    activeSheet.load("name");
    sheet.load("name");
    await context.sync();

    if (selectedAddress && activeSheet.name === sheet.name) {
      activeSheet.getRange(selectedAddress).select();
    } else {
      sheet.getRange("A1").select();
    }
    await context.sync();
  };
}
