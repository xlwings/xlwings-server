import { describe, expect, it, vi } from "vitest";

import { createAddChart } from "../../xlwings_server/static/js/custom-scripts/chart-action-callbacks.js";

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
