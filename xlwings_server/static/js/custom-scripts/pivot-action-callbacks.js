// PivotTable action callbacks, built the same way as the chart ones: each
// factory takes the resolver it needs and returns the `(context, action)`
// callback that index.js registers under the action's func name.

export async function getPivotTableByIndex(context, sheetPosition, index) {
  const sheets = context.workbook.worksheets.load("items");
  await context.sync();
  const pivotTables = sheets.items[sheetPosition].pivotTables.load("items");
  await context.sync();
  return pivotTables.items[index];
}

// The pivot table actions all carry the pivot table's index as their first
// arg: its position within the sheet's pivotTables collection, which is the
// order the payload's pivot_tables array is built in.
export function pivotTableFromAction(context, action) {
  return getPivotTableByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
}

// A value field is addressed by its index in the pivot table's data
// hierarchies, never by its caption: captions like "Sum of Sales" are
// localized and can be renamed, so the index is the only stable handle.
export async function getValueFieldByIndex(context, pivotTable, valueIndex) {
  const dataHierarchies = pivotTable.dataHierarchies.load("items");
  await context.sync();
  const field = dataHierarchies.items[valueIndex];
  if (field === undefined) {
    throw new Error(
      `Pivot table value field index ${valueIndex} is out of range (${dataHierarchies.items.length} value fields).`,
    );
  }
  return field;
}

export function createAddPivotTable(getSheet, getSelectedRangeAddress) {
  return async function addPivotTable(context, action) {
    // Adding a pivot table selects it, which is never what a script wants.
    // Capture the current selection first so it can be put back, as
    // addChart() does.
    const selectedAddress = getSelectedRangeAddress
      ? await getSelectedRangeAddress(context)
      : null;

    const sheet = await getSheet(context, action);
    const [name, sourceKind, sourceRef, destinationAddress] = action.args;
    let source;
    switch (sourceKind) {
      case "range":
        // A sheet-qualified address string, which pivotTables.add() takes
        // as-is.
        source = sourceRef.toString();
        break;
      case "table":
        source = context.workbook.tables.getItem(sourceRef.toString());
        break;
      default:
        throw new Error(`Unknown pivot table source kind: ${sourceKind}`);
    }
    sheet.pivotTables.add(
      name.toString(),
      source,
      sheet.getRange(destinationAddress.toString()),
    );
    await context.sync();

    // getSelectedRange() is workbook-wide, so the captured address belongs to
    // whichever sheet was active -- restoring it onto the pivot table's sheet
    // would select the wrong cells. Only restore it when the pivot table
    // landed on the active sheet; otherwise deselect by selecting A1 on its
    // own sheet, which is still better than leaving it selected.
    const activeSheet = context.workbook.worksheets.getActiveWorksheet();
    activeSheet.load("name");
    sheet.load("name");
    await context.sync();

    if (selectedAddress && activeSheet.name === sheet.name) {
      activeSheet.getRange(selectedAddress).select();
    } else {
      sheet.getRange("A1").select();
    }
    await context.sync();
  };
}

export function createSetPivotTableName(getPivotTable) {
  return async function setPivotTableName(context, action) {
    const pivotTable = await getPivotTable(context, action);
    pivotTable.name = action.args[1].toString();
    await context.sync();
  };
}

// The per-area hierarchy collections of a pivot table, keyed by the area
// names Python sends.
function areaHierarchies(pivotTable, area) {
  switch (area) {
    case "rows":
      return pivotTable.rowHierarchies;
    case "columns":
      return pivotTable.columnHierarchies;
    case "filters":
      return pivotTable.filterHierarchies;
    default:
      throw new Error(`Unknown pivot table area: ${area}`);
  }
}

export function createAddPivotField(getPivotTable) {
  return async function addPivotField(context, action) {
    const pivotTable = await getPivotTable(context, action);
    const [, area, fieldName] = action.args;
    const hierarchies = areaHierarchies(pivotTable, area);
    hierarchies.add(pivotTable.hierarchies.getItem(fieldName.toString()));
    await context.sync();
  };
}

export function createRemovePivotField(getPivotTable) {
  return async function removePivotField(context, action) {
    const pivotTable = await getPivotTable(context, action);
    const [, area, fieldName] = action.args;
    const hierarchies = areaHierarchies(pivotTable, area);
    hierarchies.remove(hierarchies.getItem(fieldName.toString()));
    await context.sync();
  };
}

export function createAddPivotValueField(getPivotTable) {
  return async function addPivotValueField(context, action) {
    const pivotTable = await getPivotTable(context, action);
    const [, fieldName, summarizeBy, name, numberFormat] = action.args;
    const hierarchy = pivotTable.dataHierarchies.add(
      pivotTable.hierarchies.getItem(fieldName.toString()),
    );
    // The optional attributes keep Excel's defaults when left out. Pyodide's
    // to_js() turns None into undefined, so check loosely.
    if (summarizeBy != null) hierarchy.summarizeBy = summarizeBy.toString();
    if (name != null) hierarchy.name = name.toString();
    if (numberFormat != null) hierarchy.numberFormat = numberFormat.toString();
    await context.sync();
  };
}

export function createSetPivotValueField(getPivotTable) {
  return async function setPivotValueField(context, action) {
    const pivotTable = await getPivotTable(context, action);
    const [, valueIndex, attribute, value] = action.args;
    const field = await getValueFieldByIndex(
      context,
      pivotTable,
      Number(valueIndex),
    );
    switch (attribute) {
      case "name":
        field.name = value.toString();
        break;
      case "function":
        field.summarizeBy = value.toString();
        break;
      case "number_format":
        field.numberFormat = value.toString();
        break;
      default:
        throw new Error(
          `Unknown pivot table value field attribute: ${attribute}`,
        );
    }
    await context.sync();
  };
}

export function createRemovePivotValueField(getPivotTable) {
  return async function removePivotValueField(context, action) {
    const pivotTable = await getPivotTable(context, action);
    const field = await getValueFieldByIndex(
      context,
      pivotTable,
      Number(action.args[1]),
    );
    pivotTable.dataHierarchies.remove(field);
    await context.sync();
  };
}

export function createSetPivotLayout(getPivotTable) {
  return async function setPivotLayout(context, action) {
    const pivotTable = await getPivotTable(context, action);
    const [, attribute, value] = action.args;
    switch (attribute) {
      case "layout":
        pivotTable.layout.layoutType = value.toString();
        break;
      case "show_row_grand_totals":
        pivotTable.layout.showRowGrandTotals = Boolean(value);
        break;
      case "show_column_grand_totals":
        pivotTable.layout.showColumnGrandTotals = Boolean(value);
        break;
      default:
        throw new Error(`Unknown pivot table layout attribute: ${attribute}`);
    }
    await context.sync();
  };
}

export function createRefreshPivotTable(getPivotTable) {
  return async function refreshPivotTable(context, action) {
    const pivotTable = await getPivotTable(context, action);
    pivotTable.refresh();
    await context.sync();
  };
}

export function createDeletePivotTable(getPivotTable) {
  return async function deletePivotTable(context, action) {
    const pivotTable = await getPivotTable(context, action);
    pivotTable.delete();
    await context.sync();
  };
}
