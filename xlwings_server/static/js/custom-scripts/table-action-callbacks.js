export function createAddTable(getSheet) {
  return async function addTable(context, action) {
    const sheet = await getSheet(context, action);
    const table = sheet.tables.add(
      action.args[0].toString(),
      Boolean(action.args[1]),
    );
    if (action.args[2] != null) {
      table.style = action.args[2].toString();
    }
    if (action.args[3] != null) {
      table.name = action.args[3].toString();
    }
  };
}
