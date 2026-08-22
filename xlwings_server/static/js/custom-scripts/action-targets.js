export async function getActionSheet(context, action) {
  const worksheets = context.workbook.worksheets;
  if (typeof action?.sheet_name === "string" && action.sheet_name) {
    return worksheets.getItem(action.sheet_name);
  }

  const sheets = worksheets.load("items");
  await context.sync();
  return sheets.items[action.sheet_position];
}
