import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

beforeEach(() => {
  Office.context.requirements.isSetSupported.mockReturnValue(true);
});

const cell = (color, pattern = "Solid") => ({
  format: { fill: { color, pattern } },
});

function harness(
  cells = [
    [cell("#ff0000"), cell("#FFFFFF", "None")],
    [cell("#FFFFFF"), cell("#000000")],
  ],
) {
  let pending;
  const range = {
    address: "Report!B3:C4",
    rowCount: cells.length,
    columnCount: cells[0].length,
    load: vi.fn(),
    getCellProperties: vi.fn(() => {
      const result = {};
      pending = () => {
        result.value = cells;
      };
      return result;
    }),
    getDisplayedCellProperties: vi.fn(() => {
      throw new Error("Not a direct fill read");
    }),
  };
  const sheet = { getRange: vi.fn(() => range) };
  const worksheets = { getItem: vi.fn(() => sheet) };
  const context = {
    workbook: { worksheets },
    sync: vi.fn(async () => {
      pending?.();
    }),
  };
  vi.stubGlobal("Excel", { run: vi.fn(async (fn) => fn(context)) });
  return { range, sheet, worksheets, context };
}

it("reads mixed direct fills in bulk after synchronization, including no fill and white", async () => {
  const { range, sheet, context } = harness();
  expect(await client.getRangeData("Report", "B3:C4", ["colors"])).toEqual({
    address: "B3:C4",
    row_count: 2,
    column_count: 2,
    colors: [
      ["#ff0000", null],
      ["#FFFFFF", "#000000"],
    ],
  });
  expect(sheet.getRange).toHaveBeenCalledExactlyOnceWith("B3:C4");
  expect(range.load).toHaveBeenCalledExactlyOnceWith([
    "address",
    "rowCount",
    "columnCount",
  ]);
  expect(range.getCellProperties).toHaveBeenCalledExactlyOnceWith({
    format: { fill: { color: true, pattern: true } },
  });
  expect(range.getDisplayedCellProperties).not.toHaveBeenCalled();
  expect(context.sync).toHaveBeenCalledTimes(2);
});

it.each([
  [[[cell("#FFFFFF", "None")]], [[null]]],
  [[[cell("", "None"), cell("#00ff00")]], [[null, "#00ff00"]]],
  [
    [[cell("#00ff00")], [cell(null, "None")]],
    [["#00ff00"], [null]],
  ],
])("keeps cell, row and column dimensions", async (cells, expected) => {
  harness(cells);
  expect(
    (await client.getRangeData("Report", "B3:C4", ["colors"])).colors,
  ).toEqual(expected);
});

it("normalizes named and unprefixed colors and reads a patterned fill's background", async () => {
  const canvas = { fillStyle: "" };
  Object.defineProperty(canvas, "fillStyle", {
    get: () => "#ffa500",
    set: () => {},
  });
  document.createElement = vi.fn(() => ({ getContext: () => canvas }));
  harness([[cell("orange"), cell("00ff00", "Gray25")]]);
  expect(
    (await client.getRangeData("Report", "B3:C3", ["colors"])).colors,
  ).toEqual([["#ffa500", "#00ff00"]]);
});

it("does not fetch colors unless explicitly requested", async () => {
  const { range } = harness();
  range.format = { fill: { color: "#ff0000" } };
  const result = await client.getRangeData("Report", "B3", ["color"]);
  expect(result.color).toBe("#ff0000");
  expect(result).not.toHaveProperty("colors");
  expect(range.getCellProperties).not.toHaveBeenCalled();
});

it("rejects unsupported hosts before entering Excel.run", async () => {
  harness();
  Office.context.requirements.isSetSupported.mockReturnValue(false);
  await expect(
    client.getRangeData("Report", "B3", ["colors"]),
  ).rejects.toMatchObject({ code: "unsupported_host" });
  expect(Excel.run).not.toHaveBeenCalled();
});

it.each([
  [100001, 1],
  [1048576, 1],
  [1, 100001],
])("rejects oversized reads before fetching cells", async (rows, cols) => {
  const { range, context } = harness();
  range.rowCount = rows;
  range.columnCount = cols;
  await expect(
    client.getRangeData("Report", "A:A", ["colors"]),
  ).rejects.toMatchObject({ code: "range_too_large" });
  expect(range.getCellProperties).not.toHaveBeenCalled();
  expect(context.sync).toHaveBeenCalledOnce();
});

it("accepts the exact cell limit", async () => {
  harness(
    Array.from({ length: 1000 }, () =>
      Array.from({ length: 100 }, () => cell("#FFFFFF", "None")),
    ),
  );
  const result = await client.getRangeData("Report", "A1:CV1000", ["colors"]);
  expect(result.colors).toHaveLength(1000);
  expect(result.colors[999]).toEqual(Array(100).fill(null));
});

it.each(["ItemNotFound", "AccessDenied", "GeneralException"])(
  "propagates %s without a partial result",
  async (code) => {
    const { context } = harness();
    const error = Object.assign(new Error(code), { code });
    context.sync.mockRejectedValueOnce(error);
    await expect(client.getRangeData("Missing", "B3", ["colors"])).rejects.toBe(
      error,
    );
  },
);

it("propagates a failed cell-properties sync", async () => {
  const { context } = harness();
  const error = Object.assign(new Error("Failed read"), {
    code: "GeneralException",
  });
  context.sync.mockResolvedValueOnce().mockRejectedValueOnce(error);
  await expect(client.getRangeData("Report", "B3:C4", ["colors"])).rejects.toBe(
    error,
  );
});

it.each([
  { cells: null },
  { cells: [] },
  { cells: [[cell("#ffffff")]] },
  { cells: [[cell("#ffffff"), cell("#ffffff")], [cell("#ffffff")]] },
])("rejects incomplete cell properties", async ({ cells }) => {
  const { range } = harness();
  range.getCellProperties.mockReturnValue({ value: cells });
  await expect(
    client.getRangeData("Report", "B3:B4", ["colors"]),
  ).rejects.toMatchObject({ code: "invalid_response" });
});

it("rejects missing fill data rather than claiming it has no fill", async () => {
  harness([[{}]]);
  await expect(
    client.getRangeData("Report", "B3", ["colors"]),
  ).rejects.toMatchObject({ code: "invalid_response" });
});

it("preserves other cells when a fill has no color property", async () => {
  harness([
    [
      cell("#123456"),
      { format: { fill: {} } },
      cell(undefined),
      cell("#ffffff"),
    ],
  ]);
  const result = await client.getRangeData("Report", "B3:E3", ["colors"]);
  expect(result.colors).toEqual([["#123456", null, null, "#ffffff"]]);
});

it("normalizes repeated named colors once per distinct color per read", async () => {
  const palette = { orange: "#ffa500", blue: "#0000ff" };
  let resolved;
  const canvas = {};
  Object.defineProperty(canvas, "fillStyle", {
    get: () => resolved,
    set: (value) => {
      resolved = palette[value] || value;
    },
  });
  document.createElement = vi.fn(() => ({ getContext: () => canvas }));
  harness(
    Array.from({ length: 1000 }, () =>
      Array.from({ length: 100 }, (_, i) => cell(i % 2 ? "orange" : "blue")),
    ),
  );
  const result = await client.getRangeData("Report", "A1:CV1000", ["colors"]);
  expect(result.colors[999]).toEqual(
    Array.from({ length: 100 }, (_, i) => (i % 2 ? "#ffa500" : "#0000ff")),
  );
  expect(document.createElement).toHaveBeenCalledTimes(2);
  // Cache lifetime is one read; it cannot retain entries across workbooks.
  await client.getRangeData("Report", "A1:CV1000", ["colors"]);
  expect(document.createElement).toHaveBeenCalledTimes(4);
});

it.each([
  ["colors", "values", "formulas", "number_format", "color"],
  ["values", "formulas", "number_format", "color", "colors"],
])(
  "combines colors with value, formula and scalar formatting reads (%s first)",
  async (...keys) => {
    const { range, context } = harness();
    range.values = [
      [1, 2],
      [3, 4],
    ];
    range.formulas = [
      [1, "=1+1"],
      [3, 4],
    ];
    range.numberFormat = [
      ["General", "General"],
      ["General", "General"],
    ];
    range.format = { fill: { color: null } };
    expect(await client.getRangeData("Report", "B3:C4", keys)).toEqual({
      address: "B3:C4",
      row_count: 2,
      column_count: 2,
      values: [
        [1, 2],
        [3, 4],
      ],
      formulas: [
        [1, "=1+1"],
        [3, 4],
      ],
      number_format: "General",
      color: null,
      colors: [
        ["#ff0000", null],
        ["#FFFFFF", "#000000"],
      ],
    });
    expect(range.getCellProperties).toHaveBeenCalledOnce();
    expect(context.sync).toHaveBeenCalledTimes(2);
    expect(range.load).toHaveBeenCalledExactlyOnceWith([
      "address",
      "rowCount",
      "columnCount",
      "values",
      "numberFormat",
      "formulas",
      "format/fill/color",
    ]);
  },
);

it("rejects a combined read as a whole if cell properties fail", async () => {
  const { range, context } = harness();
  range.values = [
    [1, 2],
    [3, 4],
  ];
  range.numberFormat = [
    ["General", "General"],
    ["General", "General"],
  ];
  const error = Object.assign(new Error("Failed read"), {
    code: "GeneralException",
  });
  context.sync.mockResolvedValueOnce().mockRejectedValueOnce(error);
  await expect(
    client.getRangeData("Report", "B3:C4", ["values", "colors"]),
  ).rejects.toBe(error);
});
