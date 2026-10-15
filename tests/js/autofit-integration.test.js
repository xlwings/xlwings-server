import { afterAll, beforeAll, expect, it, vi } from "vitest";

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

// Execute queued commands on sync, including partial batch failures, instead of
// treating Office.js property assignment as an immediate host mutation.
function harness(used, settings = {}) {
  const log = [];
  const formats = new Map();
  let queue = [];
  let maskFailure = settings.failMaskAt;
  const sheet = {
    protection: {
      protected: settings.protected ?? false,
      load: vi.fn(),
    },
    getUsedRangeOrNullObject: vi.fn(() => ({
      isNullObject: used == null,
      ...used,
      load: vi.fn(),
    })),
    getRangeByIndexes: vi.fn((row, column, rowCount, columnCount) => {
      const key = `${row},${column},${rowCount},${columnCount}`;
      if (!formats.has(key)) {
        formats.set(
          key,
          settings.initialFormats?.[key] ??
            Array.from({ length: rowCount }, () =>
              Array(columnCount).fill("General"),
            ),
        );
      }
      return {
        load() {
          return this;
        },
        get numberFormat() {
          return formats.get(key);
        },
        set numberFormat(value) {
          queue.push(() => {
            const masking = value.every((row) =>
              row.every((format) => format === ";;;"),
            );
            if (masking && maskFailure === key) {
              maskFailure = null;
              throw new Error("mask failed");
            }
            formats.set(key, value);
            log.push(["numberFormat", key, value]);
          });
        },
        format: {
          autofitColumns() {
            queue.push(() => {
              if (settings.failAutofit) throw new Error("autofit failed");
              log.push(["autofitColumns", key]);
            });
          },
        },
      };
    }),
  };
  const worksheets = {
    items: [sheet],
    load: vi.fn(function () {
      return this;
    }),
    getItem: vi.fn(() => sheet),
  };
  const context = {
    workbook: { worksheets },
    sync: vi.fn(async () => {
      const batch = queue;
      queue = [];
      for (const command of batch) command();
    }),
  };
  // Like the real Excel.run, flush whatever is still queued when the callback returns
  vi.stubGlobal("Excel", {
    run: vi.fn(async (callback) => {
      await callback(context);
      await context.sync();
    }),
  });
  return { log, formats };
}

function autofitColumns(startRow, startColumn, rowCount, columnCount) {
  return client.runActions({
    actions: [
      {
        func: "setAutofit",
        sheet_position: 0,
        start_row: startRow,
        start_column: startColumn,
        row_count: rowCount,
        column_count: columnCount,
        args: ["columns"],
      },
    ],
  });
}

it("masks only the used cells above and below the range during column autofit", async () => {
  // Used range A1:D20, autofit A6:C9
  const { log } = harness({
    rowIndex: 0,
    rowCount: 20,
    columnIndex: 0,
    columnCount: 4,
  });
  await autofitColumns(5, 0, 4, 3);

  const hidden = (rows) =>
    Array.from({ length: rows }, () => Array(3).fill(";;;"));
  const general = (rows) =>
    Array.from({ length: rows }, () => Array(3).fill("General"));
  expect(log).toEqual([
    ["numberFormat", "0,0,5,3", hidden(5)],
    ["numberFormat", "9,0,11,3", hidden(11)],
    ["autofitColumns", "5,0,4,3"],
    ["numberFormat", "0,0,5,3", general(5)],
    ["numberFormat", "9,0,11,3", general(11)],
  ]);
});

it("autofits directly when nothing else is in the columns", async () => {
  const { log } = harness({
    rowIndex: 5,
    rowCount: 4,
    columnIndex: 0,
    columnCount: 3,
  });
  await autofitColumns(5, 0, 4, 3);
  expect(log).toEqual([["autofitColumns", "5,0,4,3"]]);
});

it("autofits directly on an empty sheet", async () => {
  const { log } = harness(null);
  await autofitColumns(0, 0, 2, 2);
  expect(log).toEqual([["autofitColumns", "0,0,2,2"]]);
});

it("autofits the entire columns when too many cells would need masking", async () => {
  const { log } = harness({
    rowIndex: 0,
    rowCount: 200000,
    columnIndex: 0,
    columnCount: 1,
  });
  await autofitColumns(0, 0, 1, 1);
  expect(log).toEqual([["autofitColumns", "0,0,1,1"]]);
});

it("autofits the entire columns on a protected sheet", async () => {
  const { log } = harness(
    { rowIndex: 0, rowCount: 3, columnIndex: 0, columnCount: 1 },
    { protected: true },
  );
  await autofitColumns(1, 0, 1, 1);
  expect(log).toEqual([["autofitColumns", "1,0,1,1"]]);
});

it.each([
  { failAutofit: true, message: "autofit failed" },
  { failMaskAt: "2,0,1,1", message: "mask failed" },
])(
  "restores the original formats after a partial host failure: $message",
  async (failure) => {
    const originalFormats = {
      "0,0,1,1": [["yyyy-mm-dd"]],
      "2,0,1,1": [["0.00%"]],
    };
    const { formats } = harness(
      { rowIndex: 0, rowCount: 3, columnIndex: 0, columnCount: 1 },
      { ...failure, initialFormats: originalFormats },
    );
    await expect(autofitColumns(1, 0, 1, 1)).rejects.toThrow(failure.message);
    for (const [key, format] of Object.entries(originalFormats)) {
      expect(formats.get(key)).toEqual(format);
    }
  },
);
