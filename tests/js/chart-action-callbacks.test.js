import { describe, expect, it, vi } from "vitest";

import { createAddChart } from "../../xlwings_server/static/js/custom-scripts/chart-action-callbacks.js";

function harness() {
  const chart = {};
  const sourceRange = { address: "$A$1:$B$6" };
  const sourceSheet = { getRange: vi.fn(() => sourceRange) };
  const sheet = { charts: { add: vi.fn(() => chart) } };
  const select = vi.fn();
  const activeSheet = { getRange: vi.fn(() => ({ select })) };
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
  };
}

const ACTION = {
  sheet_position: 0,
  args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", 300, 20, 450, 280],
};

describe("addChart action callback", () => {
  it("creates the chart from its type and source range", async () => {
    const { chart, sheet, sourceSheet, sourceRange, context } = harness();
    const addChart = createAddChart(vi.fn(async () => sheet));
    const action = {
      sheet_position: 0,
      args: ["MyChart", "Line", "Sheet1", "$A$1:$B$6", 300, 20, 450, 280],
    };

    await addChart(context, action);

    expect(context.workbook.worksheets.getItem).toHaveBeenCalledWith("Sheet1");
    expect(sourceSheet.getRange).toHaveBeenCalledWith("$A$1:$B$6");
    expect(sheet.charts.add).toHaveBeenCalledWith("Line", sourceRange);
    expect(chart.name).toBe("MyChart");
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
  it("restores the selection that adding a chart would have stolen", async () => {
    const { sheet, context, activeSheet, select } = harness();
    const getSelectedRangeAddress = vi.fn(async () => "$D$4");
    const addChart = createAddChart(
      vi.fn(async () => sheet),
      getSelectedRangeAddress,
    );

    await addChart(context, ACTION);

    // captured before the chart is added, restored after
    expect(getSelectedRangeAddress).toHaveBeenCalledWith(context);
    expect(activeSheet.getRange).toHaveBeenCalledWith("$D$4");
    expect(select).toHaveBeenCalled();
    expect(context.sync).toHaveBeenCalled();
  });

  it("leaves the selection alone when there was no range selected", async () => {
    // getSelectedRangeAddress reports null when a shape is selected rather
    // than a range, and there's nothing to restore.
    const { sheet, context, select } = harness();
    const addChart = createAddChart(
      vi.fn(async () => sheet),
      vi.fn(async () => null),
    );

    await addChart(context, ACTION);

    expect(select).not.toHaveBeenCalled();
    expect(
      context.workbook.worksheets.getActiveWorksheet,
    ).not.toHaveBeenCalled();
  });
});
