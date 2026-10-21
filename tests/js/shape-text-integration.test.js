import { beforeAll, describe, expect, it, vi } from "vitest";

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
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: vi.fn(() => true) } },
  });
  await import("../../xlwings_server/static/js/custom-scripts/index.js");
  client = globalThis.xlwings;
});

// `textFrameError` is what the sync after loading textFrame.hasText rejects
// with; Excel raises InvalidOperation for a shape without a text frame.
function stubShape({ text = null, textFrameError = null } = {}) {
  const font = {
    bold: true,
    italic: false,
    size: 11,
    color: "#FF0000",
    name: "Calibri",
    load: vi.fn(),
  };
  const textRange = {
    text,
    font,
    load: vi.fn(),
    getSubstring: vi.fn(() => textRange),
  };
  let textFrameLoaded = false;
  const textFrame = {
    hasText: text != null,
    textRange,
    load: vi.fn(() => {
      textFrameLoaded = true;
    }),
  };
  const shape = { textFrame };
  const shapes = { items: [shape], load: vi.fn().mockReturnThis() };
  const sheet = { shapes };
  const context = {
    workbook: { worksheets: { getItem: vi.fn(() => sheet) } },
    sync: vi.fn(async () => {
      if (textFrameLoaded && textFrameError) throw textFrameError;
    }),
  };
  vi.stubGlobal("Excel", { run: vi.fn(async (body) => body(context)) });
}

const KEYS = ["text", "characters_text", "font"];

describe("shape text reads", () => {
  it("reads text, a character slice and font from a text-bearing shape", async () => {
    stubShape({ text: "Hello" });

    expect(
      await client.getShapeData("Sheet1", 0, KEYS, { start: 0, length: 2 }),
    ).toEqual({
      text: "Hello",
      characters_text: "Hello",
      font: {
        bold: true,
        italic: false,
        size: 11,
        color: "#FF0000",
        name: "Calibri",
      },
    });
  });

  it("reports no text for a shape without a text frame, such as a picture", async () => {
    stubShape({
      textFrameError: Object.assign(new Error("Not permitted"), {
        code: "InvalidOperation",
      }),
    });

    expect(await client.getShapeData("Sheet1", 0, KEYS)).toEqual({
      text: null,
      characters_text: null,
      font: null,
    });
  });

  it("still raises other Office.js failures", async () => {
    const error = Object.assign(new Error("Busy"), {
      code: "GeneralException",
    });
    stubShape({ textFrameError: error });

    await expect(client.getShapeData("Sheet1", 0, ["text"])).rejects.toBe(
      error,
    );
  });
});
