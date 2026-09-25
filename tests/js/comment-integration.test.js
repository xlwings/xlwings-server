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
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: vi.fn(() => true) } },
  });
  await import("../../xlwings_server/static/js/custom-scripts/index.js");
  client = globalThis.xlwings;
});

it("routes threaded-comment actions and reads through the public client", async () => {
  let exists = false;
  const location = {
    address: "Sheet1!$A$1",
    worksheet: { name: "Sheet1" },
    load: vi.fn().mockReturnThis(),
  };
  const reply = { id: "r1", content: "Done", load: vi.fn().mockReturnThis() };
  const comment = {
    id: "c1",
    content: "Review",
    resolved: false,
    authorName: "Pat",
    load: vi.fn().mockReturnThis(),
    getLocation: vi.fn(() => location),
    delete: vi.fn(() => {
      exists = false;
    }),
    replies: {
      items: [reply],
      load: vi.fn().mockReturnThis(),
      getItem: vi.fn(() => reply),
      add: vi.fn(),
    },
  };
  const context = {
    pendingMissing: false,
    sync: vi.fn(async () => {
      if (context.pendingMissing) {
        context.pendingMissing = false;
        throw { code: "ItemNotFound" };
      }
    }),
  };
  const comments = {
    items: [comment],
    load: vi.fn().mockReturnThis(),
    getItemByCell: vi.fn(() => {
      if (!exists) context.pendingMissing = true;
      return comment;
    }),
    add: vi.fn((_address, text) => {
      exists = true;
      comment.content = text;
    }),
  };
  const sheet = {
    comments,
    getRange: vi.fn(() => ({
      rowCount: 1,
      columnCount: 1,
      load: vi.fn().mockReturnThis(),
    })),
  };
  const worksheets = {
    items: [sheet],
    load: vi.fn().mockReturnThis(),
    getItem: vi.fn(() => sheet),
  };
  context.workbook = {
    worksheets,
    comments: {
      ...comments,
      getItem: vi.fn(() => comment),
    },
  };
  vi.stubGlobal("Excel", { run: vi.fn(async (body) => body(context)) });

  await client.runActions(
    {
      actions: [
        { func: "addComment", sheet_position: 0, args: ["$A$1", "Review"] },
        {
          func: "setCommentText",
          sheet_position: 0,
          args: [null, "$A$1", "Updated"],
        },
        {
          func: "addCommentReply",
          sheet_position: 0,
          args: [null, "$A$1", "Done"],
        },
        {
          func: "setCommentResolved",
          sheet_position: 0,
          args: [null, "$A$1", true],
        },
      ],
    },
    context,
  );

  expect(comment.content).toBe("Updated");
  expect(comment.resolved).toBe(true);
  expect(comment.replies.add).toHaveBeenCalledWith("Done");
  expect(await client.getCommentAt("Sheet1", "$A$1")).toEqual({ id: "c1" });
  expect(await client.getCommentData("Sheet1", "c1", "$A$1", "author")).toBe(
    "Pat",
  );
  expect(await client.getComments("Sheet1")).toEqual([
    { id: "c1", sheet: "Sheet1", address: "$A$1" },
  ]);
  expect(await client.getCommentReplies("Sheet1", "c1", "$A$1")).toEqual([
    { id: "r1" },
  ]);
  expect(await client.getCommentReplyText("Sheet1", "c1", "$A$1", "r1")).toBe(
    "Done",
  );

  await client.runActions(
    {
      actions: [
        { func: "deleteComment", sheet_position: 0, args: ["c1", "$A$1"] },
      ],
    },
    context,
  );
  expect(comment.delete).toHaveBeenCalledOnce();

  await expect(
    client.runActions(
      {
        actions: [
          { func: "addComment", sheet_position: 0, args: ["$A$1", "first"] },
          { func: "addComment", sheet_position: 0, args: ["$A$1", "second"] },
        ],
      },
      context,
    ),
  ).rejects.toMatchObject({
    code: "action_failed",
    actionIndex: 1,
    appliedActionCount: 2,
    cause: { code: "CommentAlreadyExists" },
  });
});
