export function requireNotesSupport(office = globalThis.Office) {
  if (!office?.context?.requirements?.isSetSupported?.("ExcelApi", "1.18")) {
    const error = new Error("Cell notes require ExcelApi 1.18");
    error.code = "NoteApiUnsupported";
    throw error;
  }
}

export async function addCellNote(context, sheet, address, text) {
  const range = sheet.getRange(address).load("rowCount,columnCount");
  const existing = sheet.notes.getItemOrNullObject(address);
  await context.sync();
  if (range.rowCount !== 1 || range.columnCount !== 1) {
    const error = new Error("A note can only be added to a single cell");
    error.code = "InvalidNoteLocation";
    throw error;
  }
  if (!existing.isNullObject) {
    const error = new Error(`A note already exists on ${address}`);
    error.code = "NoteAlreadyExists";
    throw error;
  }
  sheet.notes.add(address, text);
}

export async function readNoteAuthor(context, sheet, address) {
  const note = sheet.notes.getItemOrNullObject(address);
  note.load("authorName");
  await context.sync();
  return note.isNullObject ? null : note.authorName;
}

export async function readNoteLocation(context, sheet, address) {
  const note = sheet.notes.getItemOrNullObject(address);
  await context.sync();
  if (note.isNullObject) return null;
  const location = note.getLocation().load("address");
  await context.sync();
  return location.address.split("!").pop();
}
