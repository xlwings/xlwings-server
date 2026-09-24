import { describe, expect, it, vi } from "vitest";

import {
  addCellNote,
  readNoteAuthor,
  readNoteLocation,
  requireNotesSupport,
} from "../../xlwings_server/static/js/custom-scripts/note-operations.js";

function fixture({ rowCount = 1, columnCount = 1, exists = false } = {}) {
  const range = { rowCount, columnCount, load: vi.fn().mockReturnThis() };
  const note = {
    isNullObject: !exists,
    authorName: "Pat",
    load: vi.fn().mockReturnThis(),
    getLocation: vi.fn(() => ({
      address: "Sheet1!B3",
      load: vi.fn().mockReturnThis(),
    })),
  };
  const sheet = {
    getRange: vi.fn(() => range),
    notes: {
      getItemOrNullObject: vi.fn(() => note),
      add: vi.fn(),
    },
  };
  return { context: { sync: vi.fn(async () => {}) }, sheet, note, range };
}

describe("notes", () => {
  it("checks ExcelApi 1.18 before accessing notes", () => {
    expect(() =>
      requireNotesSupport({
        context: {
          requirements: {
            isSetSupported: () => false,
          },
        },
      }),
    ).toThrow(/1.18/);
  });

  it("adds only to one empty cell", async () => {
    const { context, sheet } = fixture();
    await addCellNote(context, sheet, "$A$1", "Review");
    expect(sheet.notes.add).toHaveBeenCalledWith("$A$1", "Review");
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it("rejects multi-cell ranges and existing notes", async () => {
    const multi = fixture({ columnCount: 2 });
    await expect(
      addCellNote(multi.context, multi.sheet, "A1:B1", "x"),
    ).rejects.toMatchObject({ code: "InvalidNoteLocation" });
    expect(multi.sheet.notes.add).not.toHaveBeenCalled();
    const occupied = fixture({ exists: true });
    await expect(
      addCellNote(occupied.context, occupied.sheet, "A1", "x"),
    ).rejects.toMatchObject({ code: "NoteAlreadyExists" });
  });

  it("propagates a protected-sheet failure without applying a second write", async () => {
    const { context, sheet } = fixture();
    const error = Object.assign(new Error("protected"), {
      code: "AccessDenied",
    });
    sheet.notes.add.mockImplementation(() => {
      throw error;
    });
    await expect(addCellNote(context, sheet, "A1", "x")).rejects.toBe(error);
    expect(sheet.notes.add).toHaveBeenCalledOnce();
  });

  it("reads author and location, including missing notes", async () => {
    const present = fixture({ exists: true });
    expect(await readNoteAuthor(present.context, present.sheet, "A1")).toBe(
      "Pat",
    );
    expect(await readNoteLocation(present.context, present.sheet, "A1")).toBe(
      "B3",
    );
    expect(present.context.sync).toHaveBeenCalledTimes(3);
    const missing = fixture();
    expect(
      await readNoteAuthor(missing.context, missing.sheet, "A1"),
    ).toBeNull();
    expect(
      await readNoteLocation(missing.context, missing.sheet, "A1"),
    ).toBeNull();
    expect(missing.note.getLocation).not.toHaveBeenCalled();
  });
});
