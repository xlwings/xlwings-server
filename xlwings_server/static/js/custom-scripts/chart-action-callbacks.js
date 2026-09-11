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
    // seriesBy (args[8]) is optional: Python leaves it out when the user
    // didn't say, which keeps Office.js' "Auto" heuristic.
    const seriesBy = action.args[8];
    const chart =
      seriesBy == null
        ? sheet.charts.add(
            action.args[1].toString(),
            sourceSheet.getRange(action.args[3].toString()),
          )
        : sheet.charts.add(
            action.args[1].toString(),
            sourceSheet.getRange(action.args[3].toString()),
            seriesBy.toString(),
          );
    // An anchor cell (args[9]) positions the chart via setPosition(), which
    // takes *cell references*. left/top are points, like xlwings' geometry,
    // so they can't go through setPosition() -- passing points to it makes
    // Excel reject the whole action batch.
    if (action.args[9] != null) {
      chart.setPosition(sheet.getRange(action.args[9].toString()));
    }
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

export async function getChartByIndex(context, sheetPosition, chartIndex) {
  const sheets = context.workbook.worksheets.load("items");
  await context.sync();
  const charts = sheets.items[sheetPosition].charts.load("items");
  await context.sync();
  return charts.items[chartIndex];
}

// The chart actions all carry the chart's index as their first arg.
export function chartFromAction(context, action) {
  return getChartByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
}

export function createSetChartSourceData(getChart) {
  return async function setChartSourceData(context, action) {
    const chart = await getChart(context, action);
    const sourceSheet = context.workbook.worksheets.getItem(
      action.args[1].toString(),
    );
    const range = sourceSheet.getRange(action.args[2].toString());
    // seriesBy is only sent when explicit; without it, setData() defaults
    // to Auto. Pyodide's to_js() turns None into undefined, so check loosely.
    const seriesBy = action.args[3];
    if (seriesBy == null) {
      chart.setData(range);
    } else {
      chart.setData(range, seriesBy.toString());
    }
  };
}

export function createSetChartTitle(getChart) {
  // null hides the title; a string shows it and sets the text
  return async function setChartTitle(context, action) {
    const chart = await getChart(context, action);
    const text = action.args[1];
    if (text == null) {
      chart.title.visible = false;
    } else {
      chart.title.visible = true;
      chart.title.text = text.toString();
    }
  };
}

export function createSetChartLegend(getChart) {
  // One action per attribute, in the order Python wrote them: a position
  // implies a visible legend, on both sides.
  return async function setChartLegend(context, action) {
    const chart = await getChart(context, action);
    const [, attribute, value] = action.args;
    switch (attribute) {
      case "visible":
        chart.legend.visible = Boolean(value);
        break;
      case "position":
        chart.legend.visible = true;
        chart.legend.position = value.toString();
        break;
      default:
        throw new Error(`Unknown chart legend attribute: ${attribute}`);
    }
  };
}

export function createSetChartPlotBy(getChart) {
  return async function setChartPlotBy(context, action) {
    const chart = await getChart(context, action);
    chart.plotBy = action.args[1].toString();
  };
}

export function createSetChartStyle(getChart) {
  return async function setChartStyle(context, action) {
    const chart = await getChart(context, action);
    chart.style = Number(action.args[1]);
  };
}
