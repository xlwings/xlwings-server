import { beforeAll, expect, it, vi } from "vitest";

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

it("routes addNote and metadata reads through the public client", async () => {
  const note = {
    isNullObject: true,
    authorName: "Pat",
    load: vi.fn().mockReturnThis(),
    getLocation: vi.fn(() => ({
      address: "Sheet1!A1",
      load: vi.fn().mockReturnThis(),
    })),
  };
  const sheet = {
    getRange: vi.fn(() => ({
      rowCount: 1,
      columnCount: 1,
      load: vi.fn().mockReturnThis(),
    })),
    notes: {
      getItemOrNullObject: vi.fn(() => note),
      add: vi.fn(() => {
        note.isNullObject = false;
      }),
    },
  };
  const worksheets = {
    items: [sheet],
    load: vi.fn().mockReturnThis(),
    getItem: vi.fn(() => sheet),
  };
  const context = {
    workbook: { worksheets },
    sync: vi.fn(async () => {}),
  };
  vi.stubGlobal("Excel", { run: vi.fn(async (body) => body(context)) });

  await client.runActions(
    {
      actions: [
        { func: "addNote", sheet_position: 0, args: ["$A$1", "Review"] },
      ],
    },
    context,
  );
  expect(sheet.notes.add).toHaveBeenCalledWith("$A$1", "Review");
  expect(await client.getNoteAuthor("Sheet1", "$A$1")).toBe("Pat");
  expect(await client.getNoteLocation("Sheet1", "$A$1")).toBe("A1");

  note.isNullObject = true;
  await expect(
    client.runActions(
      {
        actions: [
          { func: "addNote", sheet_position: 0, args: ["$A$1", "first"] },
          { func: "addNote", sheet_position: 0, args: ["$A$1", "second"] },
        ],
      },
      context,
    ),
  ).rejects.toMatchObject({
    code: "action_failed",
    actionIndex: 1,
    appliedActionCount: 2,
    actionFunc: "addNote",
    cause: { code: "NoteAlreadyExists" },
  });
});
