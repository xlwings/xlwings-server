import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../xlwings_server/static/js/config.js", () => ({ config: {} }));
vi.mock("../../xlwings_server/static/js/alerts/parent.js", () => ({
  xlAlert: vi.fn(),
}));
vi.mock("../../xlwings_server/static/js/entraid.js", () => ({
  getAccessToken: vi.fn(),
}));
vi.mock("../../xlwings_server/static/js/wasm.js", () => ({
  pyodideReadyPromise: Promise.resolve(),
  startPyodide: vi.fn(),
}));
vi.mock(
  "../../xlwings_server/static/js/custom-scripts/sheet-buttons.js",
  () => ({ registerSheetButtons: vi.fn() }),
);
vi.mock("../../xlwings_server/static/js/utils.js", () => ({
  getActiveBookName: vi.fn(),
  printSupportedApiVersions: vi.fn(),
  getCultureInfoName: vi.fn(),
  getDateFormat: vi.fn(),
  showGlobalError: vi.fn(),
  showGlobalStatus: vi.fn(),
  hideGlobalError: vi.fn(),
  hideGlobalStatus: vi.fn(),
  request: {},
}));

let client;
beforeAll(async () => {
  vi.stubGlobal("document", { addEventListener: vi.fn() });
  vi.stubGlobal("callbacks", {});
  vi.stubGlobal("xlwings", undefined);
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: vi.fn(() => true) } },
  });
  await import("../../xlwings_server/static/js/custom-scripts/index.js");
  client = globalThis.xlwings;
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() =>
  Office.context.requirements.isSetSupported.mockReturnValue(true),
);

function harness() {
  const rows = [false, false, false];
  const columns = [false, false, false];
  const range = {
    address: "Report!A1:C3",
    rowCount: 3,
    columnCount: 3,
    load: vi.fn(function () {
      return this;
    }),
    get rowHidden() {
      return rows.every(Boolean) ? true : rows.some(Boolean) ? null : false;
    },
    get columnHidden() {
      return columns.every(Boolean)
        ? true
        : columns.some(Boolean)
          ? null
          : false;
    },
  };
  const target = {
    getEntireRow: vi.fn(() => ({
      set rowHidden(value) {
        rows[1] = value;
      },
    })),
    getEntireColumn: vi.fn(() => ({
      set columnHidden(value) {
        columns[1] = value;
      },
    })),
  };
  const sheet = {
    getRange: vi.fn(() => range),
    getRangeByIndexes: vi.fn(() => target),
  };
  const worksheets = {
    items: [sheet],
    load: vi.fn(function () {
      return this;
    }),
    getItem: vi.fn(() => sheet),
  };
  const context = { workbook: { worksheets }, sync: vi.fn(async () => {}) };
  vi.stubGlobal("Excel", { run: vi.fn(async (callback) => callback(context)) });
  return { rows, columns, range, target, sheet, context };
}

it("dispatches visibility writes and reads mixed states through the shipped client", async () => {
  const { range, target } = harness();
  await client.runActions({
    actions: [
      {
        func: "setRowHidden",
        sheet_position: 0,
        start_row: 1,
        start_column: 1,
        row_count: 1,
        column_count: 1,
        args: [true],
      },
      {
        func: "setColumnHidden",
        sheet_position: 0,
        start_row: 1,
        start_column: 1,
        row_count: 1,
        column_count: 1,
        args: [true],
      },
    ],
  });
  expect(target.getEntireRow).toHaveBeenCalledOnce();
  expect(target.getEntireColumn).toHaveBeenCalledOnce();
  expect(
    await client.getRangeData("Report", "A1:C3", [
      "row_hidden",
      "column_hidden",
    ]),
  ).toEqual({
    address: "A1:C3",
    row_count: 3,
    column_count: 3,
    row_hidden: null,
    column_hidden: null,
  });
  expect(range.load).toHaveBeenCalledWith([
    "address",
    "rowCount",
    "columnCount",
    "rowHidden",
    "columnHidden",
  ]);
});

it("rejects reads on hosts without ExcelApi 1.2 before entering Excel.run", async () => {
  harness();
  Office.context.requirements.isSetSupported.mockReturnValue(false);
  await expect(
    client.getRangeData("Report", "A1", ["row_hidden"]),
  ).rejects.toThrow("ExcelApi 1.2");
  expect(Excel.run).not.toHaveBeenCalled();
});

it("propagates a missing worksheet read error", async () => {
  const { context } = harness();
  context.workbook.worksheets.getItem.mockImplementation(() => {
    throw new Error("ItemNotFound");
  });
  await expect(
    client.getRangeData("Missing", "A1", ["row_hidden"]),
  ).rejects.toThrow("ItemNotFound");
});

it("propagates a protected-sheet failure instead of reporting success", async () => {
  const { context, target } = harness();
  context.sync
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("ProtectedSheet"));
  await expect(
    client.runActions({
      actions: [
        {
          func: "setRowHidden",
          sheet_position: 0,
          start_row: 1,
          start_column: 0,
          row_count: 1,
          column_count: 1,
          args: [true],
        },
      ],
    }),
  ).rejects.toThrow("ProtectedSheet");
  expect(target.getEntireRow).toHaveBeenCalledOnce();
});
