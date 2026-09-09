import { unqualifiedAddress } from "./workbook-metadata.js";

/** Read both name scopes in batches, regardless of the number of sheets. */
export async function readNamedItems(context, scopes) {
  for (const { collection, scopeSheet } of scopes) {
    collection.load("name, type, formula");
    if (scopeSheet) scopeSheet.load("name, position");
  }
  await context.sync();

  const entries = scopes.flatMap(({ collection, scopeSheet = null }) =>
    // Preserve the native payload; xlwings.Names applies the shared filter.
    collection.items.map((item) => ({
      item,
      scopeSheet,
      // Non-range definitions include constants, LAMBDAs, and broken references.
      range: item.type === "Range" ? item.getRangeOrNullObject() : null,
    })),
  );
  await context.sync();

  for (const entry of entries) {
    if (entry.range && !entry.range.isNullObject) {
      entry.range.load("address");
      entry.sheet = entry.range.worksheet.load("position");
    } else {
      // Includes names referring to multiple areas, which Office.js cannot
      // resolve to a single range. Their formula must still be preserved.
      entry.range = null;
    }
  }
  await context.sync();

  return entries.map(({ item, range, sheet, scopeSheet }) => ({
    name: item.name,
    refers_to: item.formula,
    type: item.type,
    sheet_index: sheet ? sheet.position : null,
    address: unqualifiedAddress(range),
    scope_sheet_name: scopeSheet ? scopeSheet.name : null,
    scope_sheet_index: scopeSheet ? scopeSheet.position : null,
    book_scope: scopeSheet === null,
  }));
}
