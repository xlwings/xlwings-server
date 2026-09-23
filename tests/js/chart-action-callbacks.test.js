import { describe, expect, it, vi } from "vitest";

import {
  createAddChart,
  createGetChartAxisData,
  createGetChartSeriesCount,
  createGetChartSeriesData,
  createSetChartAxis,
  createSetChartSeries,
  createSetChartLegend,
  createSetChartPlotBy,
  createSetChartSourceData,
  createSetChartStyle,
  createSetChartTitle,
  createSetChartXAxisValues,
  getChartByIndex,
} from "../../xlwings_server/static/js/custom-scripts/chart-action-callbacks.js";

function harness({ activeSheetName = "Dashboard" } = {}) {
  const chart = {};
  const sourceRange = { address: "$A$1:$B$6" };
  const sourceSheet = { getRange: vi.fn(() => sourceRange) };
  const select = vi.fn();
  // The sheet the chart lands on; named so the callback can compare it with
  // the active sheet.
  const sheet = {
    name: "Dashboard",
    load: vi.fn(),
    charts: { add: vi.fn(() => chart) },
    getRange: vi.fn(() => ({ select })),
  };
  const activeSelect = vi.fn();
  const activeSheet = {
    name: activeSheetName,
    load: vi.fn(),
    getRange: vi.fn(() => ({ select: activeSelect })),
  };
  const context = {
    workbook: {
      worksheets: {
        getItem: vi.fn(() => sourceSheet),
        getActiveWorksheet: vi.fn(() => activeSheet),
      },
    },
    sync: vi.fn(async () => {}),
  };
  return {
    chart,
    sheet,
    sourceSheet,
    sourceRange,
    context,
    activeSheet,
    select,
    activeSelect,
  };
}

const ACTION = {
  sheet_position: 0,
  args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", 300, 20, 450, 280],
};

describe("getChartByIndex", () => {
  it("validates stale sheet and chart indexes", async () => {
    const chart = {};
    const charts = {
      count: 1,
      getItemAt: vi.fn(() => chart),
      load: vi.fn(function () {
        return this;
      }),
    };
    const sheet = { charts };
    const sheets = {
      items: [sheet],
      load: vi.fn(function () {
        return this;
      }),
    };
    const context = {
      workbook: { worksheets: sheets },
      sync: vi.fn(async () => {}),
    };

    await expect(getChartByIndex(context, 1, 0)).rejects.toThrow(
      "No sheet at position 1",
    );
    await expect(getChartByIndex(context, 0, 1)).rejects.toThrow(
      "No chart at index 1 on sheet position 0",
    );
    await expect(getChartByIndex(context, 0, 0)).resolves.toBe(chart);
  });
});

describe("addChart action callback", () => {
  it("creates the chart from its type and source range", async () => {
    const { chart, sheet, sourceSheet, sourceRange, context } = harness();
    const addChart = createAddChart(vi.fn(async () => sheet));
    const action = {
      sheet_position: 0,
      args: [
        "MyChart",
        "Line",
        "Sheet1",
        "$A$1:$B$6",
        300,
        20,
        450,
        280,
        null,
        null,
        227,
      ],
    };

    await addChart(context, action);

    expect(context.workbook.worksheets.getItem).toHaveBeenCalledWith("Sheet1");
    expect(sourceSheet.getRange).toHaveBeenCalledWith("$A$1:$B$6");
    expect(sheet.charts.add).toHaveBeenCalledWith("Line", sourceRange);
    expect(chart.name).toBe("MyChart");
    expect(chart.style).toBe(227);
  });

  it("retains Excel's native style when creation receives null", async () => {
    const { chart, sheet, context } = harness();
    const addChart = createAddChart(vi.fn(async () => sheet));

    await addChart(context, {
      sheet_position: 0,
      args: [
        "MyChart",
        "Line",
        "Sheet1",
        "$A$1:$B$6",
        300,
        20,
        450,
        280,
        null,
        null,
        null,
      ],
    });

    expect(chart).not.toHaveProperty("style");
  });

  it("sets the geometry as points rather than through setPosition()", async () => {
    // Chart.setPosition() takes cell references, so passing xlwings' points to
    // it makes Excel reject the whole action batch.
    const { chart, sheet, context } = harness();
    chart.setPosition = vi.fn();
    const addChart = createAddChart(vi.fn(async () => sheet));

    await addChart(context, {
      sheet_position: 0,
      args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", 300, 20, 450, 280],
    });

    expect(chart.setPosition).not.toHaveBeenCalled();
    expect(chart.left).toBe(300);
    expect(chart.top).toBe(20);
    expect(chart.width).toBe(450);
    expect(chart.height).toBe(280);
  });

  it("passes seriesBy only when Python sent one", async () => {
    // Without it, Office.js keeps its "Auto" heuristic.
    const { chart, sheet, sourceRange, context } = harness();
    const addChart = createAddChart(vi.fn(async () => sheet));

    await addChart(context, {
      sheet_position: 0,
      args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", 0, 0, 355, 211, "Rows"],
    });
    expect(sheet.charts.add).toHaveBeenLastCalledWith(
      "Line",
      sourceRange,
      "Rows",
    );

    await addChart(context, {
      sheet_position: 0,
      args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", 0, 0, 355, 211, null],
    });
    expect(sheet.charts.add).toHaveBeenLastCalledWith("Line", sourceRange);
    expect(chart.name).toBe("MyChart");
  });

  it("positions the chart at the anchor cell and keeps the requested size", async () => {
    const { chart, sheet, context } = harness();
    const anchorRange = { address: "$D$4" };
    sheet.getRange = vi.fn((address) =>
      address === "$D$4" ? anchorRange : { select: vi.fn() },
    );
    chart.setPosition = vi.fn();
    const addChart = createAddChart(vi.fn(async () => sheet));

    await addChart(context, {
      sheet_position: 0,
      args: [
        "MyChart",
        "Line",
        "Sheet1",
        "$A$1:$B$6",
        null,
        null,
        450,
        280,
        null,
        "$D$4",
      ],
    });

    expect(chart.setPosition).toHaveBeenCalledWith(anchorRange);
    expect(chart.left).toBeUndefined();
    expect(chart.top).toBeUndefined();
    expect(chart.width).toBe(450);
    expect(chart.height).toBe(280);
  });

  it("leaves geometry alone when it isn't supplied", async () => {
    const { chart, sheet, context } = harness();
    const addChart = createAddChart(vi.fn(async () => sheet));

    await addChart(context, {
      sheet_position: 0,
      args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", null, null, null, null],
    });

    expect(chart).toEqual({ name: "MyChart" });
  });
});

describe("addChart selection handling", () => {
  it("restores the previous selection when the chart is on the active sheet", async () => {
    const { sheet, context, activeSheet, activeSelect } = harness({
      activeSheetName: "Dashboard",
    });
    const getSelectedRangeAddress = vi.fn(async () => "$D$4");
    const addChart = createAddChart(
      vi.fn(async () => sheet),
      getSelectedRangeAddress,
    );

    await addChart(context, ACTION);

    expect(getSelectedRangeAddress).toHaveBeenCalledWith(context);
    expect(activeSheet.getRange).toHaveBeenCalledWith("$D$4");
    expect(activeSelect).toHaveBeenCalled();
  });

  it("selects A1 on the chart's sheet when the selection is elsewhere", async () => {
    // getSelectedRange() is workbook-wide, so a selection on another sheet
    // must not be replayed onto the chart's sheet -- that would select the
    // wrong cells. Deselect the chart instead.
    const { sheet, context, activeSheet, select, activeSelect } = harness({
      activeSheetName: "Income Statement",
    });
    const addChart = createAddChart(
      vi.fn(async () => sheet),
      vi.fn(async () => "$D$4"),
    );

    await addChart(context, ACTION);

    expect(activeSheet.getRange).not.toHaveBeenCalled();
    expect(activeSelect).not.toHaveBeenCalled();
    expect(sheet.getRange).toHaveBeenCalledWith("A1");
    expect(select).toHaveBeenCalled();
  });

  it("still deselects the chart when nothing was selected", async () => {
    // A freshly added sheet has no prior range selection, which is exactly
    // the case that used to leave the new chart selected.
    const { sheet, context, select } = harness();
    const addChart = createAddChart(
      vi.fn(async () => sheet),
      vi.fn(async () => null),
    );

    await addChart(context, ACTION);

    expect(sheet.getRange).toHaveBeenCalledWith("A1");
    expect(select).toHaveBeenCalled();
  });

  it("deselects even without a selection helper", async () => {
    const { sheet, context, select } = harness();
    const addChart = createAddChart(vi.fn(async () => sheet));

    await addChart(context, ACTION);

    expect(sheet.getRange).toHaveBeenCalledWith("A1");
    expect(select).toHaveBeenCalled();
  });
});

function chartHarness() {
  const chart = { title: {}, legend: {} };
  const sourceRange = { address: "$A$1:$B$6" };
  const sourceSheet = { getRange: vi.fn(() => sourceRange) };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sourceSheet) } },
    sync: vi.fn(async () => {}),
  };
  const getChart = vi.fn(async () => chart);
  return { chart, sourceRange, sourceSheet, context, getChart };
}

describe("setChartSourceData action callback", () => {
  it("accepts the legacy three-argument payload and lets Excel pick", async () => {
    const { chart, sourceRange, sourceSheet, context, getChart } =
      chartHarness();
    chart.setData = vi.fn();
    const setChartSourceData = createSetChartSourceData(getChart);

    await setChartSourceData(context, {
      sheet_position: 0,
      args: [0, "Sheet1", "$A$1:$B$6"],
    });

    expect(context.workbook.worksheets.getItem).toHaveBeenCalledWith("Sheet1");
    expect(sourceSheet.getRange).toHaveBeenCalledWith("$A$1:$B$6");
    expect(chart.setData).toHaveBeenCalledWith(sourceRange);
  });

  it("passes an explicit seriesBy through", async () => {
    const { chart, sourceRange, context, getChart } = chartHarness();
    chart.setData = vi.fn();
    const setChartSourceData = createSetChartSourceData(getChart);

    await setChartSourceData(context, {
      sheet_position: 0,
      args: [0, "Sheet1", "$A$1:$B$6", "Columns"],
    });

    expect(chart.setData).toHaveBeenCalledWith(sourceRange, "Columns");
  });
});

describe("setChartXAxisValues action callback", () => {
  it("assigns one category range to every chart series", async () => {
    const { chart, sourceRange, sourceSheet, context, getChart } =
      chartHarness();
    const first = { setXAxisValues: vi.fn() };
    const second = { setXAxisValues: vi.fn() };
    const series = { items: [first, second] };
    chart.series = { load: vi.fn(() => series) };
    const setChartXAxisValues = createSetChartXAxisValues(getChart);

    await setChartXAxisValues(context, {
      sheet_position: 0,
      args: [0, "Sheet1", "$A$2:$A$6"],
    });

    expect(context.workbook.worksheets.getItem).toHaveBeenCalledWith("Sheet1");
    expect(sourceSheet.getRange).toHaveBeenCalledWith("$A$2:$A$6");
    expect(chart.series.load).toHaveBeenCalledWith("items");
    expect(context.sync).toHaveBeenCalledTimes(2);
    expect(first.setXAxisValues).toHaveBeenCalledWith(sourceRange);
    expect(second.setXAxisValues).toHaveBeenCalledWith(sourceRange);
  });
});

describe("setChartTitle action callback", () => {
  it("shows the title and sets its text", async () => {
    const { chart, context, getChart } = chartHarness();
    const setChartTitle = createSetChartTitle(getChart);

    await setChartTitle(context, { sheet_position: 0, args: [0, "Sales"] });

    expect(getChart).toHaveBeenCalledWith(context, {
      sheet_position: 0,
      args: [0, "Sales"],
    });
    expect(chart.title).toEqual({ visible: true, text: "Sales" });
  });

  it("hides the title for null without touching the text", async () => {
    const { chart, context, getChart } = chartHarness();
    const setChartTitle = createSetChartTitle(getChart);

    await setChartTitle(context, { sheet_position: 0, args: [0, null] });

    expect(chart.title).toEqual({ visible: false });
  });
});

function axisHarness({ visible = true } = {}) {
  const categoryAxis = {
    visible,
    title: { visible: false, text: "" },
    load: vi.fn(),
  };
  categoryAxis.title.load = vi.fn();
  const valueAxis = {
    visible,
    title: { visible: false, text: "" },
    load: vi.fn(),
  };
  valueAxis.title.load = vi.fn();
  const chart = { axes: { categoryAxis, valueAxis } };
  const context = { sync: vi.fn(async () => {}) };
  const getChart = vi.fn(async () => chart);
  const supported = vi.fn(() => true);
  return { chart, categoryAxis, valueAxis, context, getChart, supported };
}

describe("setChartAxis action callback", () => {
  it("sets all requested value-axis attributes in one action", async () => {
    const { valueAxis, context, getChart, supported } = axisHarness();
    const setChartAxis = createSetChartAxis(getChart, supported);

    await setChartAxis(context, {
      sheet_position: 0,
      args: [
        0,
        "value",
        {
          title: "Revenue",
          minimum_scale: 0,
          maximum_scale: 100,
          major_unit: 20,
          number_format: "$#,##0",
          visible: true,
        },
      ],
    });

    expect(supported).toHaveBeenCalledWith("ExcelApi", "1.8");
    expect(valueAxis).toMatchObject({
      visible: true,
      minimum: 0,
      maximum: 100,
      majorUnit: 20,
      numberFormat: "$#,##0",
    });
    expect(valueAxis.title).toMatchObject({ visible: true, text: "Revenue" });
    expect(context.sync).toHaveBeenCalledTimes(2);
  });

  it("maps null scales to Office.js automatic values", async () => {
    const { categoryAxis, context, getChart } = axisHarness();
    await createSetChartAxis(getChart)(context, {
      args: [
        0,
        "category",
        { minimum_scale: null, maximum_scale: null, major_unit: null },
      ],
    });
    expect(categoryAxis.minimum).toBe("");
    expect(categoryAxis.maximum).toBe("");
    expect(categoryAxis.majorUnit).toBe("");
  });

  it("shows an absent axis for a title and applies explicit hiding last", async () => {
    const { valueAxis, context, getChart } = axisHarness({ visible: false });
    await createSetChartAxis(getChart)(context, {
      args: [0, "value", { title: "Revenue", visible: false }],
    });
    expect(valueAxis.title).toMatchObject({ visible: true, text: "Revenue" });
    expect(valueAxis.visible).toBe(false);
  });

  it("temporarily shows an absent axis to format it before hiding", async () => {
    const { valueAxis, context, getChart } = axisHarness({ visible: false });
    await createSetChartAxis(getChart)(context, {
      args: [0, "value", { minimum_scale: 0, visible: false }],
    });
    expect(valueAxis.minimum).toBe(0);
    expect(valueAxis.visible).toBe(false);
  });

  it("rejects formatting an absent axis unless the request shows it", async () => {
    const { context, getChart } = axisHarness({ visible: false });
    await expect(
      createSetChartAxis(getChart)(context, {
        args: [0, "value", { minimum_scale: 0 }],
      }),
    ).rejects.toThrow("Set visible=True first");
  });

  it.each([
    ["axis type", [0, "series", { visible: true }], "Unknown chart axis type"],
    [
      "attribute",
      [0, "value", { logarithmic: true }],
      "Unknown chart axis attribute",
    ],
    ["major unit", [0, "value", { major_unit: 0 }], "positive finite number"],
    [
      "numeric string",
      [0, "value", { minimum_scale: "0" }],
      "finite number or null",
    ],
    [
      "boolean scale",
      [0, "value", { maximum_scale: true }],
      "finite number or null",
    ],
    [
      "number format",
      [0, "value", { number_format: null }],
      "must be a string",
    ],
    ["values payload", [0, "value", null], "values must be an object"],
  ])("rejects an invalid %s", async (_label, args, message) => {
    const { context, getChart } = axisHarness();
    await expect(
      createSetChartAxis(getChart)(context, { args }),
    ).rejects.toThrow(message);
  });

  it("rejects unsupported hosts before resolving a chart", async () => {
    const { context, getChart } = axisHarness();
    await expect(
      createSetChartAxis(getChart, () => false)(context, {
        args: [0, "value", { visible: true }],
      }),
    ).rejects.toThrow("require ExcelApi 1.8");
    expect(getChart).not.toHaveBeenCalled();
  });

  it("propagates a protected-chart failure from the mutation sync", async () => {
    const { context, getChart } = axisHarness();
    context.sync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("The chart is protected"));
    await expect(
      createSetChartAxis(getChart)(context, {
        args: [0, "value", { title: "Revenue" }],
      }),
    ).rejects.toThrow("The chart is protected");
  });

  it("propagates a missing-chart failure before touching an axis", async () => {
    const { context } = axisHarness();
    const getChart = vi.fn(async () => {
      throw new Error("No chart at index 4");
    });
    await expect(
      createSetChartAxis(getChart)(context, {
        args: [4, "value", { visible: true }],
      }),
    ).rejects.toThrow("No chart at index 4");
  });
});

function axisReadHarness({ visible = true, includeChart = true } = {}) {
  const axis = {
    visible,
    minimum: 0,
    maximum: 100,
    majorUnit: 20,
    numberFormat: "$#,##0",
    load: vi.fn(),
    title: { visible: true, text: "Revenue", load: vi.fn() },
  };
  const chart = {
    axes: { categoryAxis: { ...axis }, valueAxis: axis },
  };
  const charts = {
    count: includeChart ? 1 : 0,
    getItemAt: vi.fn(() => chart),
    load: vi.fn(function () {
      return this;
    }),
  };
  const sheet = { charts };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
    sync: vi.fn(async () => {}),
  };
  const runExcel = vi.fn(async (callback) => await callback(context));
  return { axis, chart, charts, sheet, context, runExcel };
}

describe("getChartAxisData", () => {
  it("reads the requested host-backed values", async () => {
    const { axis, context, runExcel } = axisReadHarness();
    const getChartAxisData = createGetChartAxisData(runExcel);

    await expect(
      getChartAxisData("Sheet1", 0, "value", [
        "title",
        "minimum_scale",
        "maximum_scale",
        "major_unit",
        "number_format",
        "visible",
      ]),
    ).resolves.toEqual({
      title: "Revenue",
      minimum_scale: 0,
      maximum_scale: 100,
      major_unit: 20,
      number_format: "$#,##0",
      visible: true,
    });
    expect(axis.load).toHaveBeenNthCalledWith(1, "visible");
    expect(axis.load).toHaveBeenNthCalledWith(2, [
      "minimum",
      "maximum",
      "majorUnit",
      "numberFormat",
    ]);
    expect(context.sync).toHaveBeenCalledTimes(3);
  });

  it("returns false and no title for an absent axis", async () => {
    const { runExcel } = axisReadHarness({ visible: false });
    await expect(
      createGetChartAxisData(runExcel)("Sheet1", 0, "value", [
        "visible",
        "title",
      ]),
    ).resolves.toEqual({ visible: false, title: null });
  });

  it("rejects unavailable formatting on an absent axis", async () => {
    const { runExcel } = axisReadHarness({ visible: false });
    await expect(
      createGetChartAxisData(runExcel)("Sheet1", 0, "value", ["minimum_scale"]),
    ).rejects.toThrow("minimum_scale is unavailable");
  });

  it("reports a missing chart", async () => {
    const { runExcel } = axisReadHarness({ includeChart: false });
    await expect(
      createGetChartAxisData(runExcel)("Sheet1", 0, "value", ["visible"]),
    ).rejects.toThrow("No chart at index 0 on sheet Sheet1");
  });

  it("validates support and read keys before entering Excel.run", async () => {
    const { runExcel } = axisReadHarness();
    await expect(
      createGetChartAxisData(runExcel, () => false)("Sheet1", 0, "value", [
        "visible",
      ]),
    ).rejects.toThrow("require ExcelApi 1.8");
    await expect(
      createGetChartAxisData(runExcel)("Sheet1", 0, "value", ["log_base"]),
    ).rejects.toThrow("Unknown chart axis read key");
    expect(runExcel).not.toHaveBeenCalled();
  });
});

function seriesHarness({ includeChart = true, includeSeries = true } = {}) {
  const fillColor = { value: "#778899" };
  const series = {
    name: "Revenue",
    markerStyle: "Circle",
    markerSize: 8,
    markerForegroundColor: "#112233",
    markerBackgroundColor: "#445566",
    load: vi.fn(),
    format: {
      line: { color: "#556677", load: vi.fn() },
      fill: {
        setSolidColor: vi.fn(),
        getSolidColor: vi.fn(() => fillColor),
      },
    },
  };
  const seriesCollection = {
    count: includeSeries ? 1 : 0,
    getItemAt: vi.fn(() => series),
    load: vi.fn(function () {
      return this;
    }),
  };
  const chart = { series: seriesCollection };
  const charts = {
    count: includeChart ? 1 : 0,
    getItemAt: vi.fn(() => chart),
    load: vi.fn(function () {
      return this;
    }),
  };
  const sheet = { charts };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
    sync: vi.fn(async () => {}),
  };
  const getChart = vi.fn(async () => chart);
  const runExcel = vi.fn(async (callback) => await callback(context));
  const supported = vi.fn(() => true);
  return {
    chart,
    charts,
    context,
    fillColor,
    getChart,
    runExcel,
    series,
    seriesCollection,
    supported,
  };
}

describe("setChartSeries action callback", () => {
  it("sets all requested attributes in one action", async () => {
    const { context, getChart, series, supported } = seriesHarness();
    await createSetChartSeries(getChart, supported)(context, {
      args: [
        0,
        0,
        {
          name: "Forecast",
          marker_style: "Diamond",
          marker_size: 9,
          marker_foreground_color: "#010203",
          marker_background_color: "#040506",
          line_color: "#070809",
          fill_color: "#0A0B0C",
        },
      ],
    });

    expect(series).toMatchObject({
      name: "Forecast",
      markerStyle: "Diamond",
      markerSize: 9,
      markerForegroundColor: "#010203",
      markerBackgroundColor: "#040506",
    });
    expect(series.format.line.color).toBe("#070809");
    expect(series.format.fill.setSolidColor).toHaveBeenCalledWith("#0A0B0C");
    expect(supported).toHaveBeenCalledWith("ExcelApi", "1.1");
    expect(supported).toHaveBeenCalledWith("ExcelApi", "1.7");
    expect(context.sync).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["attribute", { shadow: true }, "Unknown chart series attribute"],
    ["name", { name: 1 }, "name must be a string"],
    ["marker style", { marker_style: "Picture" }, "marker style"],
    ["marker size", { marker_size: 73 }, "integer from 2 to 72"],
    ["color", { line_color: "red" }, "#RRGGBB"],
  ])("rejects an invalid %s", async (_label, values, message) => {
    const { context, getChart } = seriesHarness();
    await expect(
      createSetChartSeries(getChart)(context, { args: [0, 0, values] }),
    ).rejects.toThrow(message);
    expect(getChart).not.toHaveBeenCalled();
  });

  it("rejects marker formatting on hosts below ExcelApi 1.7", async () => {
    const { context, getChart } = seriesHarness();
    const supported = vi.fn((_name, version) => version !== "1.7");
    await expect(
      createSetChartSeries(getChart, supported)(context, {
        args: [0, 0, { marker_size: 8 }],
      }),
    ).rejects.toThrow("requires ExcelApi 1.7");
    expect(getChart).not.toHaveBeenCalled();
  });

  it("reports a missing series", async () => {
    const { context, getChart } = seriesHarness({ includeSeries: false });
    await expect(
      createSetChartSeries(getChart)(context, {
        args: [0, 1, { name: "Forecast" }],
      }),
    ).rejects.toThrow("No chart series at index 1");
  });

  it("propagates a protected-chart failure from the mutation sync", async () => {
    const { context, getChart } = seriesHarness();
    context.sync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("The chart is protected"));
    await expect(
      createSetChartSeries(getChart)(context, {
        args: [0, 0, { name: "Forecast" }],
      }),
    ).rejects.toThrow("The chart is protected");
  });
});

describe("chart series reads", () => {
  it("reads the collection count", async () => {
    const { runExcel } = seriesHarness();
    await expect(
      createGetChartSeriesCount(runExcel)("Sheet1", 0),
    ).resolves.toBe(1);
  });

  it("returns zero for an empty series collection", async () => {
    const { runExcel } = seriesHarness({ includeSeries: false });
    await expect(
      createGetChartSeriesCount(runExcel)("Sheet1", 0),
    ).resolves.toBe(0);
  });

  it("reads all host-backed values", async () => {
    const { context, runExcel, series, supported } = seriesHarness();
    await expect(
      createGetChartSeriesData(runExcel, supported)("Sheet1", 0, 0),
    ).resolves.toEqual({
      name: "Revenue",
      marker_style: "Circle",
      marker_size: 8,
      marker_foreground_color: "#112233",
      marker_background_color: "#445566",
      line_color: "#556677",
      fill_color: "#778899",
    });
    expect(series.load).toHaveBeenCalledWith([
      "name",
      "markerStyle",
      "markerSize",
      "markerForegroundColor",
      "markerBackgroundColor",
    ]);
    expect(series.format.line.load).toHaveBeenCalledWith("color");
    expect(supported).toHaveBeenCalledWith("ExcelApi", "1.16");
    expect(context.sync).toHaveBeenCalledTimes(3);
  });

  it("validates keys and fill-read support before entering Excel.run", async () => {
    const { runExcel } = seriesHarness();
    await expect(
      createGetChartSeriesData(runExcel)("Sheet1", 0, 0, ["shadow"]),
    ).rejects.toThrow("Unknown chart series read key");
    const supported = vi.fn((_name, version) => version !== "1.16");
    await expect(
      createGetChartSeriesData(runExcel, supported)("Sheet1", 0, 0, [
        "fill_color",
      ]),
    ).rejects.toThrow("requires ExcelApi 1.16");
    expect(runExcel).not.toHaveBeenCalled();
  });

  it("reports missing charts and series", async () => {
    const missingChart = seriesHarness({ includeChart: false });
    await expect(
      createGetChartSeriesCount(missingChart.runExcel)("Sheet1", 0),
    ).rejects.toThrow("No chart at index 0 on sheet Sheet1");
    const missingSeries = seriesHarness({ includeSeries: false });
    await expect(
      createGetChartSeriesData(missingSeries.runExcel)("Sheet1", 0, 0, [
        "name",
      ]),
    ).rejects.toThrow("No chart series at index 0");
  });
});

describe("setChartLegend action callback", () => {
  it("position then hide ends hidden", async () => {
    const { chart, context, getChart } = chartHarness();
    const setChartLegend = createSetChartLegend(getChart);

    await setChartLegend(context, {
      sheet_position: 0,
      args: [0, "position", "Bottom"],
    });
    expect(chart.legend).toEqual({ visible: true, position: "Bottom" });

    await setChartLegend(context, {
      sheet_position: 0,
      args: [0, "visible", false],
    });
    expect(chart.legend.visible).toBe(false);
  });

  it("hide then position ends visible at that position", async () => {
    const { chart, context, getChart } = chartHarness();
    const setChartLegend = createSetChartLegend(getChart);

    await setChartLegend(context, {
      sheet_position: 0,
      args: [0, "visible", false],
    });
    await setChartLegend(context, {
      sheet_position: 0,
      args: [0, "position", "Top"],
    });

    expect(chart.legend).toEqual({ visible: true, position: "Top" });
  });

  it("rejects an unknown attribute before touching the chart", async () => {
    const { chart, context, getChart } = chartHarness();
    const setChartLegend = createSetChartLegend(getChart);

    await expect(
      setChartLegend(context, {
        sheet_position: 0,
        args: [0, "overlay", true],
      }),
    ).rejects.toThrow("Unknown chart legend attribute: overlay");
    expect(chart.legend).toEqual({});
  });
});

describe("setChartPlotBy and setChartStyle action callbacks", () => {
  it("assigns plotBy", async () => {
    const { chart, context, getChart } = chartHarness();
    await createSetChartPlotBy(getChart)(context, {
      sheet_position: 0,
      args: [0, "Rows"],
    });
    expect(chart.plotBy).toBe("Rows");
  });

  it("assigns style as a number", async () => {
    const { chart, context, getChart } = chartHarness();
    await createSetChartStyle(getChart)(context, {
      sheet_position: 0,
      args: [0, "12"],
    });
    expect(chart.style).toBe(12);
  });
});
