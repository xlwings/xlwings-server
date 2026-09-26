import { describe, expect, it, vi } from "vitest";

import { createGetPivotTableRangeAddress } from "../../xlwings_server/static/js/custom-scripts/pivot-range-read.js";

function harness({ values = 1, protectedSheet = false } = {}) {
  const report = { address: "'Pivot Sheet'!$A$3:$C$8", load: vi.fn() };
  const body = { address: "'Pivot Sheet'!$B$4:$C$8", load: vi.fn() };
  report.load.mockReturnValue(report);
  body.load.mockReturnValue(body);
  const dataHierarchies = {
    items: Array.from({ length: values }, () => ({})),
    load: vi.fn(),
  };
  dataHierarchies.load.mockReturnValue(dataHierarchies);
  const pivot = {
    id: "pivot-1",
    dataHierarchies,
    layout: {
      getRange: vi.fn(() => report),
      getDataBodyRange: vi.fn(() => body),
    },
  };
  const other = { id: "other" };
  const pivots = { items: [other, pivot], load: vi.fn() };
  pivots.load.mockReturnValue(pivots);
  const sheet = {
    pivotTables: pivots,
    protection: { protected: protectedSheet },
  };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
    sync: vi.fn(async () => {}),
  };
  const run = vi.fn(async (callback) => callback(context));
  const isSupported = vi.fn(() => true);
  const read = createGetPivotTableRangeAddress(run, isSupported);
  return { read, run, isSupported, context, pivot, pivots, report, body };
}

describe("PivotTable range reads", () => {
  it("reads the report range without the filters area and selects by stable ID", async () => {
    const { read, pivot, pivots, context } = harness();

    expect(await read("Pivot Sheet", 0, "pivot-1", "report")).toBe("$A$3:$C$8");
    expect(pivots.load).toHaveBeenCalledWith("items/id");
    expect(pivot.layout.getRange).toHaveBeenCalledOnce();
    expect(pivot.layout.getDataBodyRange).not.toHaveBeenCalled();
    expect(context.sync).toHaveBeenCalledTimes(2);
  });

  it("reads the values area on a protected sheet", async () => {
    const { read, pivot, context } = harness({ protectedSheet: true });

    expect(await read("Pivot Sheet", 1, "pivot-1", "data_body")).toBe(
      "$B$4:$C$8",
    );
    expect(pivot.dataHierarchies.load).toHaveBeenCalledWith("items");
    expect(pivot.layout.getDataBodyRange).toHaveBeenCalledOnce();
    expect(context.sync).toHaveBeenCalledTimes(3);
  });

  it("returns null when Excel has no value fields, despite stale metadata", async () => {
    const { read, pivot } = harness({ values: 0 });

    expect(await read("Pivot Sheet", 1, "pivot-1", "data_body")).toBeNull();
    expect(pivot.layout.getDataBodyRange).not.toHaveBeenCalled();
  });

  it("uses the index for a new PivotTable without a loaded ID", async () => {
    const { read } = harness();
    expect(await read("Pivot Sheet", 1, null, "report")).toBe("$A$3:$C$8");
  });

  it("rejects a missing PivotTable without reading a different one", async () => {
    const { read } = harness();
    await expect(
      read("Pivot Sheet", 0, "deleted", "report"),
    ).rejects.toMatchObject({ code: "pivot_table_not_found" });
    await expect(read("Pivot Sheet", 4, null, "report")).rejects.toMatchObject({
      code: "pivot_table_not_found",
    });
  });

  it("rejects invalid arguments and unsupported hosts before Excel.run", async () => {
    const { read, run, isSupported } = harness();
    await expect(read("Pivot Sheet", -1, null, "report")).rejects.toMatchObject(
      { code: "invalid_pivot_table_read" },
    );
    expect(run).not.toHaveBeenCalled();
    isSupported.mockReturnValue(false);
    await expect(read("Pivot Sheet", 0, null, "report")).rejects.toMatchObject({
      code: "unsupported_pivot_table",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("propagates Office read errors without applying any action", async () => {
    const { read, pivot } = harness();
    const error = Object.assign(new Error("Access denied"), {
      code: "AccessDenied",
    });
    pivot.layout.getRange.mockImplementation(() => {
      throw error;
    });
    await expect(read("Pivot Sheet", 1, "pivot-1", "report")).rejects.toBe(
      error,
    );
  });
});
