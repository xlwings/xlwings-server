import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Keep the real client entry point, dispatch, targeting, and read-key mapping.
// Only unrelated task-pane startup dependencies are mocked.
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
  () => ({
    registerSheetButtons: vi.fn(),
  }),
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
  await import("../../xlwings_server/static/js/custom-scripts/index.js");
  client = globalThis.xlwings;
});
afterAll(() => vi.unstubAllGlobals());

function harness(
  horizontalAlignment = "General",
  verticalAlignment = "Bottom",
) {
  const stored = { horizontalAlignment, verticalAlignment };
  const pendingWrites = {};
  const pendingLoads = new Set();
  const loaded = new Set();
  const format = {};
  for (const property of Object.keys(stored)) {
    Object.defineProperty(format, property, {
      get() {
        // Office.js reads require both load() and a completed sync().
        if (!loaded.has(`format/${property}`)) {
          throw new Error(`Property not loaded: ${property}`);
        }
        return stored[property];
      },
      set(value) {
        pendingWrites[property] = value;
      },
    });
  }
  const range = {
    address: "Report!$B$3:$C$4",
    rowCount: 2,
    columnCount: 2,
    format,
    load: vi.fn((paths) => {
      paths.forEach((path) => pendingLoads.add(path));
      return range;
    }),
  };
  const sheet = {
    getRange: vi.fn(() => range),
    getRangeByIndexes: vi.fn(() => range),
  };
  const worksheets = {
    items: [{}, sheet],
    load: vi.fn(() => worksheets),
    getItem: vi.fn(() => sheet),
  };
  const context = {
    workbook: { worksheets },
    sync: vi.fn(async () => {
      Object.assign(stored, pendingWrites);
      pendingLoads.forEach((path) => loaded.add(path));
    }),
  };
  vi.stubGlobal("Excel", { run: vi.fn(async (fn) => fn(context)) });
  return { stored, sheet, worksheets, context };
}

const axes = [
  [
    "horizontal_alignment",
    "horizontalAlignment",
    "setHorizontalAlignment",
    [
      "General",
      "Left",
      "Center",
      "Right",
      "Fill",
      "Justify",
      "CenterAcrossSelection",
      "Distributed",
    ],
  ],
  [
    "vertical_alignment",
    "verticalAlignment",
    "setVerticalAlignment",
    ["Top", "Center", "Bottom", "Justify", "Distributed"],
  ],
];

for (const [key, property, func, values] of axes) {
  describe(`${key} client integration`, () => {
    it.each(values)("dispatches and reads back %s", async (value) => {
      const { stored, sheet, worksheets } = harness();
      await client.runActions({
        actions: [
          {
            func,
            args: [value],
            values: null,
            sheet_position: 1,
            start_row: 2,
            start_column: 1,
            row_count: 2,
            column_count: 2,
          },
        ],
      });
      // Check before the read's own sync, which could mask a missing write sync.
      expect(stored[property]).toBe(value);
      expect(sheet.getRangeByIndexes).toHaveBeenCalledWith(2, 1, 2, 2);
      expect(await client.getRangeData("Report", "$B$3:$C$4", [key])).toEqual({
        address: "$B$3:$C$4",
        row_count: 2,
        column_count: 2,
        [key]: value,
      });
      expect(worksheets.getItem).toHaveBeenCalledWith("Report");
      expect(sheet.getRange).toHaveBeenCalledWith("$B$3:$C$4");
    });
  });
}

it("preserves null for both mixed alignments in a combined read", async () => {
  harness(null, null);
  expect(
    await client.getRangeData("Report", "$B$3:$C$4", [
      "horizontal_alignment",
      "vertical_alignment",
    ]),
  ).toEqual({
    address: "$B$3:$C$4",
    row_count: 2,
    column_count: 2,
    horizontal_alignment: null,
    vertical_alignment: null,
  });
});
