import { describe, expect, it, vi } from "vitest";

import {
  createAddPivotField,
  createAddPivotTable,
  createAddPivotValueField,
  createDeletePivotTable,
  createRefreshPivotTable,
  createRemovePivotField,
  createRemovePivotValueField,
  createSetPivotLayout,
  createSetPivotTableName,
  createSetPivotValueField,
  getValueFieldByIndex,
} from "../../xlwings_server/static/js/custom-scripts/pivot-action-callbacks.js";

function addHarness({ activeSheetName = "Report" } = {}) {
  const destination = { address: "$E$1" };
  const table = { name: "SalesTable" };
  const select = vi.fn();
  // The sheet the pivot table lands on; named so the callback can compare it
  // with the active sheet.
  const sheet = {
    name: "Report",
    load: vi.fn(),
    pivotTables: { add: vi.fn(() => ({})) },
    getRange: vi.fn((address) =>
      address === "$E$1" ? destination : { select },
    ),
  };
  const activeSelect = vi.fn();
  const activeSheet = {
    name: activeSheetName,
    load: vi.fn(),
    getRange: vi.fn(() => ({ select: activeSelect })),
  };
  const context = {
    workbook: {
      worksheets: { getActiveWorksheet: vi.fn(() => activeSheet) },
      tables: { getItem: vi.fn(() => table) },
    },
    sync: vi.fn(async () => {}),
  };
  return {
    sheet,
    destination,
    table,
    context,
    activeSheet,
    select,
    activeSelect,
  };
}

const RANGE_ACTION = {
  sheet_position: 0,
  args: ["PivotTable1", "range", "'Sheet 1'!$A$1:$C$10", "$E$1"],
};

describe("addPivotTable action callback", () => {
  it("passes a range source through as its sheet-qualified address", async () => {
    const { sheet, destination, context } = addHarness();
    const getSheet = vi.fn(async () => sheet);
    const addPivotTable = createAddPivotTable(getSheet);

    await addPivotTable(context, RANGE_ACTION);

    expect(getSheet).toHaveBeenCalledWith(context, RANGE_ACTION);
    expect(sheet.getRange).toHaveBeenCalledWith("$E$1");
    expect(sheet.pivotTables.add).toHaveBeenCalledWith(
      "PivotTable1",
      "'Sheet 1'!$A$1:$C$10",
      destination,
    );
    expect(context.workbook.tables.getItem).not.toHaveBeenCalled();
  });

  it("resolves a table source from the workbook's tables", async () => {
    const { sheet, destination, table, context } = addHarness();
    const addPivotTable = createAddPivotTable(vi.fn(async () => sheet));

    await addPivotTable(context, {
      sheet_position: 0,
      args: ["PivotTable1", "table", "SalesTable", "$E$1"],
    });

    expect(context.workbook.tables.getItem).toHaveBeenCalledWith("SalesTable");
    expect(sheet.pivotTables.add).toHaveBeenCalledWith(
      "PivotTable1",
      table,
      destination,
    );
  });

  it("rejects an unknown source kind before adding anything", async () => {
    const { sheet, context } = addHarness();
    const addPivotTable = createAddPivotTable(vi.fn(async () => sheet));

    await expect(
      addPivotTable(context, {
        sheet_position: 0,
        args: ["PivotTable1", "query", "x", "$E$1"],
      }),
    ).rejects.toThrow("Unknown pivot table source kind: query");
    expect(sheet.pivotTables.add).not.toHaveBeenCalled();
  });
});

describe("addPivotTable selection handling", () => {
  it("restores the previous selection when the pivot table is on the active sheet", async () => {
    const { sheet, context, activeSheet, activeSelect } = addHarness({
      activeSheetName: "Report",
    });
    const getSelectedRangeAddress = vi.fn(async () => "$D$4");
    const addPivotTable = createAddPivotTable(
      vi.fn(async () => sheet),
      getSelectedRangeAddress,
    );

    await addPivotTable(context, RANGE_ACTION);

    expect(getSelectedRangeAddress).toHaveBeenCalledWith(context);
    expect(activeSheet.getRange).toHaveBeenCalledWith("$D$4");
    expect(activeSelect).toHaveBeenCalled();
  });

  it("selects A1 on the pivot table's sheet when the selection is elsewhere", async () => {
    // getSelectedRange() is workbook-wide, so a selection on another sheet
    // must not be replayed onto the pivot table's sheet.
    const { sheet, context, activeSheet, select, activeSelect } = addHarness({
      activeSheetName: "Data",
    });
    const addPivotTable = createAddPivotTable(
      vi.fn(async () => sheet),
      vi.fn(async () => "$D$4"),
    );

    await addPivotTable(context, RANGE_ACTION);

    expect(activeSheet.getRange).not.toHaveBeenCalled();
    expect(activeSelect).not.toHaveBeenCalled();
    expect(sheet.getRange).toHaveBeenCalledWith("A1");
    expect(select).toHaveBeenCalled();
  });

  it("deselects even without a selection helper", async () => {
    const { sheet, context, select } = addHarness();
    const addPivotTable = createAddPivotTable(vi.fn(async () => sheet));

    await addPivotTable(context, RANGE_ACTION);

    expect(sheet.getRange).toHaveBeenCalledWith("A1");
    expect(select).toHaveBeenCalled();
  });
});

// A fake pivot table whose hierarchy collections record what's added and
// removed. getItem() returns a tagged marker so the tests can check which
// collection a hierarchy came from.
function pivotHarness({ valueFields = [] } = {}) {
  const makeCollection = (label) => ({
    add: vi.fn(),
    remove: vi.fn(),
    getItem: vi.fn((name) => ({ from: label, name })),
  });
  const dataHierarchy = {};
  const pivotTable = {
    hierarchies: makeCollection("hierarchies"),
    rowHierarchies: makeCollection("rows"),
    columnHierarchies: makeCollection("columns"),
    filterHierarchies: makeCollection("filters"),
    dataHierarchies: {
      add: vi.fn(() => dataHierarchy),
      remove: vi.fn(),
      items: valueFields,
      load: vi.fn(function () {
        return this;
      }),
    },
    layout: {},
    refresh: vi.fn(),
    delete: vi.fn(),
  };
  const context = { sync: vi.fn(async () => {}) };
  const getPivotTable = vi.fn(async () => pivotTable);
  return { pivotTable, dataHierarchy, context, getPivotTable };
}

describe("setPivotTableName action callback", () => {
  it("renames the pivot table resolved from the action", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    const action = { sheet_position: 0, args: [0, "Sales by Region"] };

    await createSetPivotTableName(getPivotTable)(context, action);

    expect(getPivotTable).toHaveBeenCalledWith(context, action);
    expect(pivotTable.name).toBe("Sales by Region");
    expect(context.sync).toHaveBeenCalled();
  });
});

describe("addPivotField action callback", () => {
  it.each([
    ["rows", "rowHierarchies"],
    ["columns", "columnHierarchies"],
    ["filters", "filterHierarchies"],
  ])("adds the hierarchy to the %s area", async (area, collection) => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    const addPivotField = createAddPivotField(getPivotTable);

    await addPivotField(context, {
      sheet_position: 0,
      args: [0, area, "Region"],
    });

    expect(pivotTable.hierarchies.getItem).toHaveBeenCalledWith("Region");
    expect(pivotTable[collection].add).toHaveBeenCalledWith({
      from: "hierarchies",
      name: "Region",
    });
  });

  it("rejects an unknown area before touching the pivot table", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    const addPivotField = createAddPivotField(getPivotTable);

    await expect(
      addPivotField(context, { sheet_position: 0, args: [0, "pages", "X"] }),
    ).rejects.toThrow("Unknown pivot table area: pages");
    expect(pivotTable.rowHierarchies.add).not.toHaveBeenCalled();
    expect(pivotTable.columnHierarchies.add).not.toHaveBeenCalled();
    expect(pivotTable.filterHierarchies.add).not.toHaveBeenCalled();
  });
});

describe("removePivotField action callback", () => {
  it.each([
    ["rows", "rowHierarchies"],
    ["columns", "columnHierarchies"],
    ["filters", "filterHierarchies"],
  ])(
    "removes the hierarchy from the %s area's own collection",
    async (area, collection) => {
      const { pivotTable, context, getPivotTable } = pivotHarness();
      const removePivotField = createRemovePivotField(getPivotTable);

      await removePivotField(context, {
        sheet_position: 0,
        args: [0, area, "Region"],
      });

      // The item comes from the area collection, not the field list: Office.js
      // wants the placed hierarchy, not the underlying field.
      expect(pivotTable[collection].getItem).toHaveBeenCalledWith("Region");
      expect(pivotTable[collection].remove).toHaveBeenCalledWith({
        from: area,
        name: "Region",
      });
      expect(pivotTable.hierarchies.getItem).not.toHaveBeenCalled();
    },
  );

  it("rejects an unknown area", async () => {
    const { context, getPivotTable } = pivotHarness();
    await expect(
      createRemovePivotField(getPivotTable)(context, {
        sheet_position: 0,
        args: [0, "pages", "X"],
      }),
    ).rejects.toThrow("Unknown pivot table area: pages");
  });
});

describe("addPivotValueField action callback", () => {
  it("adds the field to the values area and applies every attribute", async () => {
    const { pivotTable, dataHierarchy, context, getPivotTable } =
      pivotHarness();
    const addPivotValueField = createAddPivotValueField(getPivotTable);

    await addPivotValueField(context, {
      sheet_position: 0,
      args: [0, "Sales", "Average", "Avg Sales", "#,##0.00"],
    });

    expect(pivotTable.hierarchies.getItem).toHaveBeenCalledWith("Sales");
    expect(pivotTable.dataHierarchies.add).toHaveBeenCalledWith({
      from: "hierarchies",
      name: "Sales",
    });
    expect(dataHierarchy).toEqual({
      summarizeBy: "Average",
      name: "Avg Sales",
      numberFormat: "#,##0.00",
    });
  });

  it("keeps Excel's defaults for null attributes", async () => {
    const { dataHierarchy, context, getPivotTable } = pivotHarness();
    const addPivotValueField = createAddPivotValueField(getPivotTable);

    await addPivotValueField(context, {
      sheet_position: 0,
      args: [0, "Sales", null, null, null],
    });

    expect(dataHierarchy).toEqual({});
  });

  it("treats undefined like null, as Pyodide sends None that way", async () => {
    const { dataHierarchy, context, getPivotTable } = pivotHarness();
    const addPivotValueField = createAddPivotValueField(getPivotTable);

    await addPivotValueField(context, {
      sheet_position: 0,
      args: [0, "Sales", "Count", undefined, undefined],
    });

    expect(dataHierarchy).toEqual({ summarizeBy: "Count" });
  });
});

describe("setPivotValueField action callback", () => {
  // Captions deliberately don't match anything the action names, proving
  // the field is picked by index rather than looked up by name.
  const valueFields = () => [
    { name: "Something Else" },
    { name: "Sum of Sales" },
  ];

  it.each([
    ["name", "Total Sales", "name"],
    ["function", "Max", "summarizeBy"],
    ["number_format", "0.0%", "numberFormat"],
  ])(
    "sets %s on the value field at the given index",
    async (attribute, value, property) => {
      const fields = valueFields();
      const { pivotTable, context, getPivotTable } = pivotHarness({
        valueFields: fields,
      });
      const setPivotValueField = createSetPivotValueField(getPivotTable);

      await setPivotValueField(context, {
        sheet_position: 0,
        args: [0, 1, attribute, value],
      });

      expect(pivotTable.dataHierarchies.load).toHaveBeenCalledWith("items");
      expect(fields[1][property]).toBe(value);
      expect(fields[0]).toEqual({ name: "Something Else" });
    },
  );

  it("rejects an unknown attribute without changing the field", async () => {
    const fields = valueFields();
    const { context, getPivotTable } = pivotHarness({ valueFields: fields });
    const setPivotValueField = createSetPivotValueField(getPivotTable);

    await expect(
      setPivotValueField(context, {
        sheet_position: 0,
        args: [0, 1, "caption", "x"],
      }),
    ).rejects.toThrow("Unknown pivot table value field attribute: caption");
    expect(fields[1]).toEqual({ name: "Sum of Sales" });
  });

  it("fails clearly when the index is out of range", async () => {
    const { context, getPivotTable } = pivotHarness({
      valueFields: valueFields(),
    });
    const setPivotValueField = createSetPivotValueField(getPivotTable);

    await expect(
      setPivotValueField(context, {
        sheet_position: 0,
        args: [0, 2, "name", "x"],
      }),
    ).rejects.toThrow(
      "Pivot table value field index 2 is out of range (2 value fields).",
    );
  });
});

describe("removePivotValueField action callback", () => {
  it("removes the value field at the given index", async () => {
    const fields = [{ name: "Something Else" }, { name: "Sum of Sales" }];
    const { pivotTable, context, getPivotTable } = pivotHarness({
      valueFields: fields,
    });
    const removePivotValueField = createRemovePivotValueField(getPivotTable);

    await removePivotValueField(context, { sheet_position: 0, args: [0, 1] });

    expect(pivotTable.dataHierarchies.remove).toHaveBeenCalledWith(fields[1]);
  });
});

describe("getValueFieldByIndex", () => {
  it("loads the data hierarchies and returns the item at the index", async () => {
    const fields = [{ name: "A" }, { name: "B" }];
    const { pivotTable, context } = pivotHarness({ valueFields: fields });

    const field = await getValueFieldByIndex(context, pivotTable, 1);

    expect(pivotTable.dataHierarchies.load).toHaveBeenCalledWith("items");
    expect(context.sync).toHaveBeenCalled();
    expect(field).toBe(fields[1]);
  });

  it("throws for an out-of-range index", async () => {
    const { pivotTable, context } = pivotHarness({ valueFields: [] });

    await expect(getValueFieldByIndex(context, pivotTable, 0)).rejects.toThrow(
      "Pivot table value field index 0 is out of range (0 value fields).",
    );
  });
});

describe("setPivotLayout action callback", () => {
  it("sets the layout type from its Office.js name", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    await createSetPivotLayout(getPivotTable)(context, {
      sheet_position: 0,
      args: [0, "layout", "Tabular"],
    });
    expect(pivotTable.layout).toEqual({ layoutType: "Tabular" });
  });

  it("toggles the row and column grand totals as booleans", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    const setPivotLayout = createSetPivotLayout(getPivotTable);

    await setPivotLayout(context, {
      sheet_position: 0,
      args: [0, "show_row_grand_totals", 0],
    });
    await setPivotLayout(context, {
      sheet_position: 0,
      args: [0, "show_column_grand_totals", true],
    });

    expect(pivotTable.layout).toEqual({
      showRowGrandTotals: false,
      showColumnGrandTotals: true,
    });
  });

  it("rejects an unknown attribute before touching the layout", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    await expect(
      createSetPivotLayout(getPivotTable)(context, {
        sheet_position: 0,
        args: [0, "style", "x"],
      }),
    ).rejects.toThrow("Unknown pivot table layout attribute: style");
    expect(pivotTable.layout).toEqual({});
  });
});

describe("refreshPivotTable and deletePivotTable action callbacks", () => {
  it("refreshes the resolved pivot table", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();
    const action = { sheet_position: 0, args: [0] };

    await createRefreshPivotTable(getPivotTable)(context, action);

    expect(getPivotTable).toHaveBeenCalledWith(context, action);
    expect(pivotTable.refresh).toHaveBeenCalled();
    expect(context.sync).toHaveBeenCalled();
  });

  it("deletes the resolved pivot table", async () => {
    const { pivotTable, context, getPivotTable } = pivotHarness();

    await createDeletePivotTable(getPivotTable)(context, {
      sheet_position: 0,
      args: [0],
    });

    expect(pivotTable.delete).toHaveBeenCalled();
    expect(context.sync).toHaveBeenCalled();
  });
});
