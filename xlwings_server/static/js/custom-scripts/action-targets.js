export async function getActionSheet(context, action) {
  // Python action payloads address sheets by position only: `append_json_action`
  // in xlwings/pro/_xlremote.py emits `sheet_position` and never a sheet name.
  const sheets = context.workbook.worksheets.load("items");
  await context.sync();
  return sheets.items[action.sheet_position];
}
