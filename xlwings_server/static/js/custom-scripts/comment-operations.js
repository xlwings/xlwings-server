import { unqualifiedAddress } from "./workbook-metadata.js";

function commentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function requireCommentsSupport(
  version = "1.10",
  office = globalThis.Office,
) {
  if (!office?.context?.requirements?.isSetSupported?.("ExcelApi", version)) {
    throw commentError(
      "CommentApiUnsupported",
      `Threaded comments require ExcelApi ${version}`,
    );
  }
}

function isMissing(error) {
  return error?.code === "ItemNotFound" || error?.code === "itemNotFound";
}

export async function findComment(context, sheet, commentId, address) {
  const comment = commentId
    ? context.workbook.comments.getItem(commentId)
    : sheet.comments.getItemByCell(address);
  comment.load("id");
  try {
    await context.sync();
    return comment;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function addCellComment(context, sheet, address, text) {
  requireCommentsSupport();
  const range = sheet.getRange(address).load("rowCount,columnCount");
  await context.sync();
  if (range.rowCount !== 1 || range.columnCount !== 1) {
    throw commentError("InvalidCommentLocation", "A comment requires one cell");
  }
  if (await findComment(context, sheet, null, address)) {
    throw commentError(
      "CommentAlreadyExists",
      `A threaded comment already exists on ${address}`,
    );
  }
  sheet.comments.add(address, text);
}

export async function listComments(context, collection) {
  requireCommentsSupport();
  collection.load("items/id");
  await context.sync();
  const locations = collection.items.map((comment) =>
    comment.getLocation().load("address,worksheet/name"),
  );
  await context.sync();
  return collection.items.map((comment, index) => ({
    id: comment.id,
    sheet: locations[index].worksheet.name,
    address: unqualifiedAddress(locations[index]),
  }));
}

export async function readCommentData(context, sheet, commentId, address, key) {
  requireCommentsSupport(key === "resolved" ? "1.11" : "1.10");
  const comment = await findComment(context, sheet, commentId, address);
  if (!comment) return null;
  const properties = {
    text: "content",
    author: "authorName",
    creation_date: "creationDate",
    resolved: "resolved",
  };
  if (key === "location") {
    const location = comment.getLocation().load("address,worksheet/name");
    await context.sync();
    return {
      sheet: location.worksheet.name,
      address: unqualifiedAddress(location),
    };
  }
  const property = properties[key];
  if (!property)
    throw commentError("InvalidCommentRead", `Unknown comment field: ${key}`);
  comment.load(property);
  await context.sync();
  return key === "creation_date"
    ? (comment.creationDate?.toISOString() ?? null)
    : comment[property];
}

export async function listCommentReplies(context, sheet, commentId, address) {
  requireCommentsSupport();
  const comment = await findComment(context, sheet, commentId, address);
  if (!comment) return [];
  const replies = comment.replies.load("items/id");
  await context.sync();
  return replies.items.map((reply) => ({ id: reply.id }));
}

export async function readCommentReplyText(
  context,
  sheet,
  commentId,
  address,
  replyId,
) {
  requireCommentsSupport();
  const comment = await findComment(context, sheet, commentId, address);
  if (!comment) return null;
  const reply = comment.replies.getItem(replyId);
  reply.load("content");
  try {
    await context.sync();
    return reply.content;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function mutateComment(
  context,
  sheet,
  commentId,
  address,
  kind,
  value,
) {
  requireCommentsSupport(kind === "resolved" ? "1.11" : "1.10");
  const comment = await findComment(context, sheet, commentId, address);
  if (!comment) {
    throw commentError("CommentNotFound", `No threaded comment on ${address}`);
  }
  switch (kind) {
    case "text":
      comment.content = value;
      break;
    case "resolved":
      comment.resolved = value;
      break;
    case "reply":
      comment.replies.add(value);
      break;
    case "delete":
      comment.delete();
      break;
    default:
      throw commentError(
        "InvalidCommentMutation",
        `Unknown comment mutation: ${kind}`,
      );
  }
}
