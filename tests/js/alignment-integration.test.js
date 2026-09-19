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
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: vi.fn(() => true) } },
  });
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
  const dataValidation = {
    type: "Decimal",
    rule: {
      decimal: {
        operator: "Between",
        formula1: "=0",
        formula2: "=1",
      },
    },
    ignoreBlanks: true,
    prompt: { showPrompt: false, title: "", message: "" },
    errorAlert: {
      showAlert: true,
      style: "Stop",
      title: "Invalid",
      message: "Enter a value from 0 through 1",
    },
  };
  dataValidation.load = vi.fn(() => dataValidation);
  const range = {
    address: "Report!$B$3:$C$4",
    rowCount: 2,
    columnCount: 2,
    format,
    dataValidation,
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
  return { stored, dataValidation, range, sheet, worksheets, context };
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

describe("worksheet position client integration", () => {
  it("moves a worksheet directly without copying it", async () => {
    const { sheet, context } = harness();
    sheet.position = 1;

    await client.runActions({
      actions: [
        {
          func: "setSheetPosition",
          args: [0],
          sheet_position: 1,
        },
      ],
    });

    expect(sheet.position).toBe(0);
    expect(context.sync).toHaveBeenCalled();
  });
});

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

it("reads data validation through the public range-data callback", async () => {
  harness();
  expect(
    await client.getRangeData("Report", "$B$3:$C$4", ["data_validation"]),
  ).toEqual({
    address: "$B$3:$C$4",
    row_count: 2,
    column_count: 2,
    data_validation: {
      type: "decimal",
      operator: "between",
      formula1: "=0",
      formula2: "=1",
      formula: null,
      source: null,
      in_cell_dropdown: null,
      ignore_blank: true,
      input_title: "",
      input_message: "",
      show_input: false,
      error_title: "Invalid",
      error_message: "Enter a value from 0 through 1",
      show_error: true,
      alert_style: "stop",
    },
  });
});

it("reads, deletes and clears conditional formats through the client", async () => {
  vi.stubGlobal("Office", {
    context: {
      requirements: { isSetSupported: vi.fn(() => true) },
    },
  });
  const { range } = harness();
  const items = [];
  function addRule(type, stopIfTrue) {
    const rule = {
      type,
      stopIfTrue,
      load: vi.fn(),
      delete: vi.fn(() => items.splice(items.indexOf(rule), 1)),
    };
    if (type === "CellValue") {
      rule.cellValue = {
        rule: { operator: "LessThan", formula1: "60" },
        load: vi.fn(),
        format: {
          fill: { color: "#FFFF00", load: vi.fn() },
          font: {
            color: null,
            bold: null,
            italic: true,
            load: vi.fn(),
          },
        },
      };
    } else if (type === "Custom") {
      rule.custom = {
        rule: { formula: "=TRUE", load: vi.fn() },
        format: {
          fill: { color: null, load: vi.fn() },
          font: {
            color: null,
            bold: null,
            italic: null,
            load: vi.fn(),
          },
        },
      };
    }
    items.push(rule);
    return rule;
  }
  addRule("CellValue", true);
  addRule("DataBar", null);
  addRule("PresetCriteria", false);
  range.conditionalFormats = {
    items,
    load: vi.fn(() => range.conditionalFormats),
    add: vi.fn((type) => addRule(type, false)),
    getItemAt: vi.fn((position) => items[position]),
    clearAll: vi.fn(() => items.splice(0)),
  };

  expect(
    await client.getRangeData("Report", "$B$3:$C$4", ["conditional_formats"]),
  ).toEqual({
    address: "$B$3:$C$4",
    row_count: 2,
    column_count: 2,
    conditional_formats: [
      {
        type: "CellValue",
        stop_if_true: true,
        operator: "LessThan",
        formula1: "60",
        formula2: null,
        fill_color: "#ffff00",
        font_color: null,
        font_bold: null,
        font_italic: true,
      },
      { type: "DataBar", stop_if_true: null },
      { type: "PresetCriteria", stop_if_true: false },
    ],
  });

  const target = {
    sheet_position: 1,
    start_row: 2,
    start_column: 1,
    row_count: 2,
    column_count: 2,
  };
  await client.runActions({
    actions: [
      {
        ...target,
        func: "deleteConditionalFormat",
        args: [
          0,
          {
            type: "CellValue",
            stop_if_true: true,
            operator: "LessThan",
            formula1: "60",
            formula2: null,
            fill_color: "#ffff00",
            font_color: null,
            font_bold: null,
            font_italic: true,
          },
        ],
      },
    ],
  });
  expect(items.map((rule) => rule.type)).toEqual(["DataBar", "PresetCriteria"]);

  await client.runActions({
    actions: [{ ...target, func: "clearConditionalFormats", args: [] }],
  });
  expect(items).toEqual([]);

  await client.runActions({
    actions: [
      {
        ...target,
        func: "addConditionalFormat",
        args: [
          {
            type: "CellValue",
            operator: "LessThan",
            formula1: "60",
            formula2: null,
            fill_color: "#ffff00",
            font_italic: true,
            stop_if_true: false,
          },
        ],
      },
    ],
  });
  const [added] = (
    await client.getRangeData("Report", "$B$3:$C$4", ["conditional_formats"])
  ).conditional_formats;
  expect(added).toMatchObject({
    type: "CellValue",
    operator: "LessThan",
    formula1: "60",
    fill_color: "#ffff00",
    font_italic: true,
  });

  await client.runActions({
    actions: [
      {
        ...target,
        func: "setConditionalFormat",
        args: [0, added, { formula1: "70", stop_if_true: true }],
      },
    ],
  });
  expect(items[0].cellValue.rule.formula1).toBe("70");
  expect(items[0].stopIfTrue).toBe(true);
});
