import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCellComment,
  findComment,
  listCommentReplies,
  listComments,
  mutateComment,
  readCommentData,
  readCommentReplyText,
  requireCommentsSupport,
} from "../../xlwings_server/static/js/custom-scripts/comment-operations.js";

function fixture() {
  const location = {
    address: "'Review!2026'!$B$3",
    worksheet: { name: "Review!2026" },
    load: vi.fn().mockReturnThis(),
  };
  const reply = {
    id: "reply-1",
    content: "Done",
    load: vi.fn().mockReturnThis(),
  };
  const replies = {
    items: [reply],
    load: vi.fn().mockReturnThis(),
    add: vi.fn(),
    getItem: vi.fn(() => reply),
  };
  const comment = {
    id: "comment-1",
    authorName: "Pat",
    content: "Review",
    creationDate: new Date("2026-09-24T10:00:00Z"),
    resolved: false,
    replies,
    getLocation: vi.fn(() => location),
    load: vi.fn().mockReturnThis(),
    delete: vi.fn(),
  };
  const range = { rowCount: 1, columnCount: 1, load: vi.fn().mockReturnThis() };
  const sheet = {
    getRange: vi.fn(() => range),
    comments: {
      items: [comment],
      getItemByCell: vi.fn(() => comment),
      add: vi.fn(),
      load: vi.fn().mockReturnThis(),
    },
  };
  const context = {
    workbook: { comments: { getItem: vi.fn(() => comment) } },
    sync: vi.fn(async () => {}),
  };
  return { context, sheet, comment, reply, range };
}

beforeEach(() => {
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: vi.fn(() => true) } },
  });
});

describe("threaded comments", () => {
  it("gates comment and resolution APIs separately", () => {
    const office = {
      context: { requirements: { isSetSupported: vi.fn(() => false) } },
    };
    expect(() => requireCommentsSupport("1.10", office)).toThrow(/1.10/);
    expect(() => requireCommentsSupport("1.11", office)).toThrow(/1.11/);
  });

  it("adds only to an empty single cell", async () => {
    const present = fixture();
    await expect(
      addCellComment(present.context, present.sheet, "B3", "New"),
    ).rejects.toMatchObject({ code: "CommentAlreadyExists" });
    expect(present.sheet.comments.add).not.toHaveBeenCalled();

    const multi = fixture();
    multi.range.rowCount = 2;
    await expect(
      addCellComment(multi.context, multi.sheet, "B3:B4", "New"),
    ).rejects.toMatchObject({ code: "InvalidCommentLocation" });

    const empty = fixture();
    empty.context.sync.mockResolvedValueOnce().mockRejectedValueOnce({
      code: "ItemNotFound",
    });
    await addCellComment(empty.context, empty.sheet, "B3", "New");
    expect(empty.sheet.comments.add).toHaveBeenCalledWith("B3", "New");
  });

  it("returns missing comments as null and rethrows protected-sheet errors", async () => {
    const missing = fixture();
    missing.context.sync.mockRejectedValueOnce({ code: "ItemNotFound" });
    expect(
      await findComment(missing.context, missing.sheet, null, "B3"),
    ).toBeNull();
    const denied = fixture();
    const error = { code: "AccessDenied" };
    denied.context.sync.mockRejectedValueOnce(error);
    await expect(
      findComment(denied.context, denied.sheet, null, "B3"),
    ).rejects.toBe(error);
  });

  it("enumerates comment IDs and locations without content", async () => {
    const { context, sheet, comment } = fixture();
    expect(await listComments(context, sheet.comments)).toEqual([
      {
        id: "comment-1",
        sheet: "Review!2026",
        address: "$B$3",
      },
    ]);
    expect(comment.load).not.toHaveBeenCalledWith("content");
    expect(
      await readCommentData(context, sheet, "comment-1", "B3", "author"),
    ).toBe("Pat");
    expect(
      await readCommentData(context, sheet, "comment-1", "B3", "creation_date"),
    ).toBe("2026-09-24T10:00:00.000Z");
    expect(
      await readCommentData(context, sheet, "comment-1", "B3", "location"),
    ).toEqual({ sheet: "Review!2026", address: "$B$3" });
  });

  it("edits, resolves, reopens, replies, and deletes through a stable ID", async () => {
    const { context, sheet, comment } = fixture();
    await mutateComment(context, sheet, "comment-1", "B3", "text", "Updated");
    expect(comment.content).toBe("Updated");
    await mutateComment(context, sheet, "comment-1", "B3", "resolved", true);
    expect(comment.resolved).toBe(true);
    await mutateComment(context, sheet, "comment-1", "B3", "resolved", false);
    expect(comment.resolved).toBe(false);
    await mutateComment(context, sheet, "comment-1", "B3", "reply", "Done");
    expect(comment.replies.add).toHaveBeenCalledWith("Done");
    expect(await listCommentReplies(context, sheet, "comment-1", "B3")).toEqual(
      [{ id: "reply-1" }],
    );
    expect(
      await readCommentReplyText(context, sheet, "comment-1", "B3", "reply-1"),
    ).toBe("Done");
    await mutateComment(context, sheet, "comment-1", "B3", "delete", null);
    expect(comment.delete).toHaveBeenCalledOnce();
  });

  it("rejects edits to a deleted comment before queueing a change", async () => {
    const { context, sheet } = fixture();
    context.sync.mockRejectedValueOnce({ code: "ItemNotFound" });
    await expect(
      mutateComment(context, sheet, "gone", "B3", "text", "Updated"),
    ).rejects.toMatchObject({ code: "CommentNotFound" });
  });
});
