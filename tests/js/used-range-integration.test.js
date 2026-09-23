import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

function harness({
  formattedAddress = "Report!B2:H20",
  valuesAddress = null,
} = {}) {
  const ranges = {
    false: {
      address: formattedAddress,
      isNullObject: formattedAddress === null,
    },
    true: {
      address: valuesAddress,
      isNullObject: valuesAddress === null,
    },
  };
  for (const range of Object.values(ranges)) {
    range.load = vi.fn(() => range);
  }
  const sheet = {
    getUsedRangeOrNullObject: vi.fn((valuesOnly) => ranges[String(valuesOnly)]),
  };
  const worksheets = { getItem: vi.fn(() => sheet) };
  const context = {
    workbook: { worksheets },
    sync: vi.fn(async () => {}),
  };
  vi.stubGlobal("Excel", { run: vi.fn(async (fn) => fn(context)) });
  return { context, ranges, sheet, worksheets };
}

describe("getUsedRangeAddress", () => {
  it("defaults to the formatting-aware used range", async () => {
    const { context, ranges, sheet, worksheets } = harness();

    await expect(client.getUsedRangeAddress("Report")).resolves.toBe("B2:H20");

    expect(worksheets.getItem).toHaveBeenCalledExactlyOnceWith("Report");
    expect(sheet.getUsedRangeOrNullObject).toHaveBeenCalledExactlyOnceWith(
      false,
    );
    expect(ranges.false.load).toHaveBeenCalledExactlyOnceWith("address");
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it("can ignore formatting-only cells", async () => {
    const { ranges, sheet } = harness({ valuesAddress: "Report!C5:D8" });

    await expect(client.getUsedRangeAddress("Report", true)).resolves.toBe(
      "C5:D8",
    );

    expect(sheet.getUsedRangeOrNullObject).toHaveBeenCalledExactlyOnceWith(
      true,
    );
    expect(ranges.true.load).toHaveBeenCalledExactlyOnceWith("address");
  });

  it("returns null for an empty worksheet", async () => {
    harness({ formattedAddress: null });

    await expect(client.getUsedRangeAddress("Report")).resolves.toBeNull();
  });

  it("propagates a missing worksheet error", async () => {
    const missing = new Error("ItemNotFound: Missing");
    const context = {
      workbook: {
        worksheets: {
          getItem: vi.fn(() => {
            throw missing;
          }),
        },
      },
      sync: vi.fn(),
    };
    vi.stubGlobal("Excel", { run: vi.fn(async (fn) => fn(context)) });

    await expect(client.getUsedRangeAddress("Missing")).rejects.toBe(missing);
    expect(context.sync).not.toHaveBeenCalled();
  });
});
