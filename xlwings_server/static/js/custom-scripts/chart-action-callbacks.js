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
    // style (args[10]) is part of creation so every backend produces the same
    // modern Excel default without a second action. null retains Excel's host
    // default when the Python caller explicitly requests style=None.
    if (action.args[10] != null) chart.style = Number(action.args[10]);
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

const CHART_AXIS_KEYS = new Set([
  "title",
  "minimum_scale",
  "maximum_scale",
  "major_unit",
  "number_format",
  "visible",
]);

const CHART_SERIES_KEYS = new Set([
  "name",
  "marker_style",
  "marker_size",
  "marker_foreground_color",
  "marker_background_color",
  "line_color",
  "fill_color",
]);
const CHART_MARKER_STYLES = new Set([
  "Automatic",
  "None",
  "Square",
  "Diamond",
  "Triangle",
  "X",
  "Star",
  "Dot",
  "Dash",
  "Circle",
  "Plus",
]);

function requireChartSeriesSupport(
  isSetSupported,
  keys,
  { reading = false } = {},
) {
  if (!isSetSupported("ExcelApi", "1.1")) {
    throw new Error(
      "Chart series require ExcelApi 1.1 and aren't supported by this Excel host.",
    );
  }
  if (
    keys.some((key) => key.startsWith("marker_")) &&
    !isSetSupported("ExcelApi", "1.7")
  ) {
    throw new Error(
      "Chart series marker formatting requires ExcelApi 1.7 and isn't supported by this Excel host.",
    );
  }
  if (
    reading &&
    keys.includes("fill_color") &&
    !isSetSupported("ExcelApi", "1.16")
  ) {
    throw new Error(
      "Reading a chart series fill color requires ExcelApi 1.16 and isn't supported by this Excel host.",
    );
  }
}

function chartSeriesValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Chart series values must be an object");
  }
  const values = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!CHART_SERIES_KEYS.has(key)) {
      throw new Error(`Unknown chart series attribute: ${key}`);
    }
    switch (key) {
      case "name":
        if (typeof raw !== "string" || raw.length > 255) {
          throw new Error(
            "Chart series name must be a string of at most 255 characters",
          );
        }
        values.name = raw;
        break;
      case "marker_style":
        if (!CHART_MARKER_STYLES.has(raw)) {
          throw new Error(`Unknown chart marker style: ${raw}`);
        }
        values.marker_style = raw;
        break;
      case "marker_size":
        if (!Number.isInteger(raw) || raw < 2 || raw > 72) {
          throw new Error(
            "Chart series marker_size must be an integer from 2 to 72",
          );
        }
        values.marker_size = raw;
        break;
      default:
        if (typeof raw !== "string" || !/^#[0-9a-f]{6}$/i.test(raw)) {
          throw new Error(`Chart series ${key} must be a #RRGGBB color`);
        }
        values[key] = raw;
        break;
    }
  }
  return values;
}

async function seriesAt(context, chart, seriesIndex) {
  const collection = chart.series.load("items");
  await context.sync();
  const series = collection.items[Number(seriesIndex)];
  if (!series) {
    throw new Error(`No chart series at index ${seriesIndex}`);
  }
  return series;
}

export function createSetChartSeries(getChart, isSetSupported = () => true) {
  return async function setChartSeries(context, action) {
    const values = chartSeriesValues(action.args[2]);
    const keys = Object.keys(values);
    requireChartSeriesSupport(isSetSupported, keys);
    const chart = await getChart(context, action);
    const series = await seriesAt(context, chart, action.args[1]);
    if (Object.hasOwn(values, "name")) series.name = values.name;
    // Excel may propagate series line/fill formatting to markers. Apply
    // explicit marker overrides afterwards so one bulk set preserves
    // independently requested colors.
    if (Object.hasOwn(values, "line_color")) {
      series.format.line.color = values.line_color;
    }
    if (Object.hasOwn(values, "fill_color")) {
      series.format.fill.setSolidColor(values.fill_color);
    }
    if (Object.hasOwn(values, "marker_style")) {
      series.markerStyle = values.marker_style;
    }
    if (Object.hasOwn(values, "marker_size")) {
      series.markerSize = values.marker_size;
    }
    if (Object.hasOwn(values, "marker_foreground_color")) {
      series.markerForegroundColor = values.marker_foreground_color;
    }
    if (Object.hasOwn(values, "marker_background_color")) {
      series.markerBackgroundColor = values.marker_background_color;
    }
    await context.sync();
  };
}

export function createGetChartSeriesCount(
  runExcel,
  isSetSupported = () => true,
) {
  return async function getChartSeriesCount(sheetName, chartIndex) {
    requireChartSeriesSupport(isSetSupported, []);
    return await runExcel(async (context) => {
      const sheet = context.workbook.worksheets.getItem(sheetName);
      const charts = sheet.charts.load("items");
      await context.sync();
      const chart = charts.items[Number(chartIndex)];
      if (!chart) {
        throw new Error(
          `No chart at index ${chartIndex} on sheet ${sheetName}`,
        );
      }
      const series = chart.series.load("count");
      await context.sync();
      return series.count;
    });
  };
}

export function createGetChartSeriesData(
  runExcel,
  isSetSupported = () => true,
) {
  return async function getChartSeriesData(
    sheetName,
    chartIndex,
    seriesIndex,
    keys = [...CHART_SERIES_KEYS],
  ) {
    const readKeys = Array.from(keys ?? []);
    for (const key of readKeys) {
      if (!CHART_SERIES_KEYS.has(key)) {
        throw new Error(`Unknown chart series read key: ${key}`);
      }
    }
    requireChartSeriesSupport(isSetSupported, readKeys, { reading: true });
    return await runExcel(async (context) => {
      const sheet = context.workbook.worksheets.getItem(sheetName);
      const charts = sheet.charts.load("items");
      await context.sync();
      const chart = charts.items[Number(chartIndex)];
      if (!chart) {
        throw new Error(
          `No chart at index ${chartIndex} on sheet ${sheetName}`,
        );
      }
      const series = await seriesAt(context, chart, seriesIndex);
      const propertyMap = {
        name: "name",
        marker_style: "markerStyle",
        marker_size: "markerSize",
        marker_foreground_color: "markerForegroundColor",
        marker_background_color: "markerBackgroundColor",
      };
      const properties = readKeys
        .filter((key) => propertyMap[key])
        .map((key) => propertyMap[key]);
      if (properties.length) series.load(properties);
      if (readKeys.includes("line_color")) series.format.line.load("color");
      const fillColor = readKeys.includes("fill_color")
        ? series.format.fill.getSolidColor()
        : null;
      if (properties.length || readKeys.includes("line_color") || fillColor) {
        await context.sync();
      }
      const result = {};
      for (const [key, property] of Object.entries(propertyMap)) {
        if (readKeys.includes(key)) result[key] = series[property];
      }
      if (readKeys.includes("line_color")) {
        result.line_color = series.format.line.color || null;
      }
      if (fillColor) result.fill_color = fillColor.value || null;
      return result;
    });
  };
}

function requireChartAxisSupport(isSetSupported) {
  if (!isSetSupported("ExcelApi", "1.8")) {
    throw new Error(
      "Chart axes require ExcelApi 1.8 and aren't supported by this Excel host.",
    );
  }
}

function chartAxisType(value) {
  const axisType = value?.toString();
  if (axisType !== "category" && axisType !== "value") {
    throw new Error(`Unknown chart axis type: ${axisType}`);
  }
  return axisType;
}

function chartAxis(chart, axisType) {
  switch (axisType) {
    case "category":
      return chart.axes.categoryAxis;
    case "value":
      return chart.axes.valueAxis;
    default:
      throw new Error(`Unknown chart axis type: ${axisType}`);
  }
}

function chartAxisValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Chart axis values must be an object");
  }
  const values = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!CHART_AXIS_KEYS.has(key)) {
      throw new Error(`Unknown chart axis attribute: ${key}`);
    }
    switch (key) {
      case "title":
        if (raw != null && typeof raw !== "string") {
          throw new Error("Chart axis title must be a string or null");
        }
        values.title = raw ?? null;
        break;
      case "minimum_scale":
      case "maximum_scale":
        if (raw != null && (typeof raw !== "number" || !Number.isFinite(raw))) {
          throw new Error(`Chart axis ${key} must be a finite number or null`);
        }
        values[key] = raw ?? null;
        break;
      case "major_unit":
        if (
          raw != null &&
          (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0)
        ) {
          throw new Error(
            "Chart axis major_unit must be a positive finite number or null",
          );
        }
        values.major_unit = raw ?? null;
        break;
      case "number_format":
        if (typeof raw !== "string") {
          throw new Error("Chart axis number_format must be a string");
        }
        values.number_format = raw;
        break;
      case "visible":
        if (typeof raw !== "boolean") {
          throw new Error("Chart axis visible must be a boolean");
        }
        values.visible = raw;
        break;
    }
  }
  return values;
}

export function createSetChartAxis(getChart, isSetSupported = () => true) {
  return async function setChartAxis(context, action) {
    requireChartAxisSupport(isSetSupported);
    const axisType = chartAxisType(action.args[1]);
    const values = chartAxisValues(action.args[2]);
    const chart = await getChart(context, action);
    const axis = chartAxis(chart, axisType);
    axis.load("visible");
    await context.sync();

    const attributes = Object.keys(values).filter((key) => key !== "visible");
    const titleShowsAxis =
      Object.hasOwn(values, "title") && values.title !== null;
    const explicitTemporaryShow = values.visible === false && attributes.length;
    if (
      !axis.visible &&
      values.visible !== true &&
      !titleShowsAxis &&
      !explicitTemporaryShow &&
      attributes.some((key) => key !== "title")
    ) {
      throw new Error(
        `The chart has no visible primary ${axisType} axis. Set visible=True first.`,
      );
    }

    if (values.visible === true || titleShowsAxis || explicitTemporaryShow) {
      axis.visible = true;
    }
    if (Object.hasOwn(values, "title")) {
      if (values.title === null) {
        axis.title.visible = false;
      } else {
        axis.title.visible = true;
        axis.title.text = values.title;
      }
    }
    if (Object.hasOwn(values, "minimum_scale")) {
      axis.minimum = values.minimum_scale === null ? "" : values.minimum_scale;
    }
    if (Object.hasOwn(values, "maximum_scale")) {
      axis.maximum = values.maximum_scale === null ? "" : values.maximum_scale;
    }
    if (Object.hasOwn(values, "major_unit")) {
      axis.majorUnit = values.major_unit === null ? "" : values.major_unit;
    }
    if (Object.hasOwn(values, "number_format")) {
      axis.numberFormat = values.number_format;
    }
    if (values.visible === false) axis.visible = false;
    await context.sync();
  };
}

export function createGetChartAxisData(runExcel, isSetSupported = () => true) {
  return async function getChartAxisData(
    sheetName,
    chartIndex,
    axisType,
    keys = [...CHART_AXIS_KEYS],
  ) {
    requireChartAxisSupport(isSetSupported);
    const normalizedAxisType = chartAxisType(axisType);
    const readKeys = Array.from(keys ?? []);
    for (const key of readKeys) {
      if (!CHART_AXIS_KEYS.has(key)) {
        throw new Error(`Unknown chart axis read key: ${key}`);
      }
    }
    return await runExcel(async (context) => {
      const sheet = context.workbook.worksheets.getItem(sheetName);
      const charts = sheet.charts;
      charts.load("items");
      await context.sync();
      const chart = charts.items[Number(chartIndex)];
      if (!chart) {
        throw new Error(
          `No chart at index ${chartIndex} on sheet ${sheetName}`,
        );
      }
      const axis = chartAxis(chart, normalizedAxisType);
      axis.load("visible");
      await context.sync();

      const result = {};
      if (readKeys.includes("visible")) result.visible = Boolean(axis.visible);
      if (!axis.visible) {
        if (readKeys.includes("title")) result.title = null;
        const unavailable = readKeys.find(
          (key) => key !== "visible" && key !== "title",
        );
        if (unavailable) {
          throw new Error(
            `The chart has no visible primary ${normalizedAxisType} axis; ${unavailable} is unavailable.`,
          );
        }
        return result;
      }

      const propertyMap = {
        minimum_scale: "minimum",
        maximum_scale: "maximum",
        major_unit: "majorUnit",
        number_format: "numberFormat",
      };
      const properties = readKeys
        .filter((key) => propertyMap[key])
        .map((key) => propertyMap[key]);
      if (properties.length) axis.load(properties);
      if (readKeys.includes("title")) axis.title.load(["visible", "text"]);
      if (properties.length || readKeys.includes("title")) {
        await context.sync();
      }

      if (readKeys.includes("title")) {
        result.title = axis.title.visible ? axis.title.text : null;
      }
      for (const [key, property] of Object.entries(propertyMap)) {
        if (readKeys.includes(key)) result[key] = axis[property];
      }
      return result;
    });
  };
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

export function createSetChartXAxisValues(getChart) {
  return async function setChartXAxisValues(context, action) {
    const chart = await getChart(context, action);
    const sourceSheet = context.workbook.worksheets.getItem(
      action.args[1].toString(),
    );
    const range = sourceSheet.getRange(action.args[2].toString());
    const series = chart.series.load("items");
    await context.sync();
    for (const item of series.items) {
      item.setXAxisValues(range);
    }
    await context.sync();
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
