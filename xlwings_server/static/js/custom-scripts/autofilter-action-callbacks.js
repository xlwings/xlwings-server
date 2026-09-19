const COMPARISON_PREFIXES = Object.freeze({
  equal_to: "=",
  not_equal_to: "<>",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equal: ">=",
  less_than_or_equal: "<=",
});

function requireApi(isSetSupported, version, target) {
  if (!isSetSupported("ExcelApi", version)) {
    throw new Error(
      `${target}.autofilter requires ExcelApi ${version} and isn't supported by this Excel host.`,
    );
  }
}

function validateField(action, argumentIndex) {
  const field = action.args?.[argumentIndex];
  const columnCount = action.column_count;
  if (
    !Number.isInteger(field) ||
    field < 1 ||
    !Number.isInteger(columnCount) ||
    field > columnCount
  ) {
    throw new Error(
      `AutoFilter field must be between 1 and ${String(columnCount)}.`,
    );
  }
  return field;
}

function escapeCustomFilterValue(value) {
  return value
    .replaceAll("~", "~~")
    .replaceAll("*", "~*")
    .replaceAll("?", "~?");
}

function comparisonCriteria(spec) {
  if (!Object.hasOwn(COMPARISON_PREFIXES, spec.operator)) {
    if (!["between", "not_between"].includes(spec.operator)) {
      throw new Error(
        `Unknown AutoFilter comparison operator: ${spec.operator}.`,
      );
    }
  }
  if (spec.value1 === null) {
    if (!["equal_to", "not_equal_to"].includes(spec.operator)) {
      throw new Error("Blank filters require equal_to or not_equal_to.");
    }
    if (spec.value2 != null) {
      throw new Error("Blank filters don't accept value2.");
    }
    return {
      filterOn: "Custom",
      criterion1: spec.operator === "equal_to" ? "=" : "<>",
    };
  }
  if (typeof spec.value1 !== "string") {
    throw new Error("AutoFilter comparison value1 must be a string or null.");
  }
  const first = escapeCustomFilterValue(spec.value1);
  if (["between", "not_between"].includes(spec.operator)) {
    if (typeof spec.value2 !== "string") {
      throw new Error(`${spec.operator} requires value2.`);
    }
    const second = escapeCustomFilterValue(spec.value2);
    return {
      filterOn: "Custom",
      criterion1: `${spec.operator === "between" ? ">=" : "<"}${first}`,
      criterion2: `${spec.operator === "between" ? "<=" : ">"}${second}`,
      operator: spec.operator === "between" ? "And" : "Or",
    };
  }
  if (spec.value2 != null) {
    throw new Error(`${spec.operator} doesn't accept value2.`);
  }
  return {
    filterOn: "Custom",
    criterion1: `${COMPARISON_PREFIXES[spec.operator]}${first}`,
  };
}

function filterCriteria(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("AutoFilter criteria must be an object.");
  }
  if (spec.type === "values") {
    if (
      !Array.isArray(spec.values) ||
      spec.values.length === 0 ||
      spec.values.some((value) => typeof value !== "string")
    ) {
      throw new Error("AutoFilter values must be a non-empty string array.");
    }
    return { filterOn: "Values", values: spec.values };
  }
  if (spec.type === "comparison") return comparisonCriteria(spec);
  throw new Error(`Unknown AutoFilter criteria type: ${String(spec.type)}.`);
}

function normalizedAddress(address) {
  return String(address).split("!").at(-1).replaceAll("$", "").toUpperCase();
}

async function matchingRangeAutoFilter(context, sheet, range) {
  const filteredRange = sheet.autoFilter.getRangeOrNullObject();
  filteredRange.load("address");
  range.load("address");
  await context.sync();
  if (filteredRange.isNullObject) return null;
  return (
    normalizedAddress(filteredRange.address) ===
    normalizedAddress(range.address)
  );
}

export function createApplyAutoFilterRange(getRange, getSheet, isSetSupported) {
  return async function applyAutoFilterRange(context, action) {
    requireApi(isSetSupported, "1.14", "Range");
    const field = validateField(action, 0);
    const criteria = filterCriteria(action.args[1]);
    const range = await getRange(context, action);
    const sheet = await getSheet(context, action);
    if ((await matchingRangeAutoFilter(context, sheet, range)) === false) {
      throw new Error(
        "This worksheet already has an AutoFilter on a different range.",
      );
    }
    sheet.autoFilter.apply(range, field - 1, criteria);
    await context.sync();
  };
}

export function createClearAutoFilterRange(getRange, getSheet, isSetSupported) {
  return async function clearAutoFilterRange(context, action) {
    requireApi(isSetSupported, "1.14", "Range");
    const field = action.args?.[0];
    if (field !== null) validateField(action, 0);
    const range = await getRange(context, action);
    const sheet = await getSheet(context, action);
    if ((await matchingRangeAutoFilter(context, sheet, range)) !== true) return;
    const fields = field === null ? action.column_count : field;
    const first = field === null ? 1 : field;
    for (let fieldIndex = first; fieldIndex <= fields; fieldIndex += 1) {
      sheet.autoFilter.clearColumnCriteria(fieldIndex - 1);
    }
    await context.sync();
  };
}

export function createApplyAutoFilterTable(getTable, isSetSupported) {
  return async function applyAutoFilterTable(context, action) {
    requireApi(isSetSupported, "1.2", "Table");
    const field = validateField(action, 1);
    const spec = action.args[2];
    const criteria = filterCriteria(spec);
    const table = await getTable(context, action);
    const filter = table.columns.getItemAt(field - 1).filter;
    if (spec.type === "values") {
      filter.applyValuesFilter(criteria.values);
    } else {
      filter.applyCustomFilter(
        criteria.criterion1,
        criteria.criterion2,
        criteria.operator,
      );
    }
    await context.sync();
  };
}

export function createClearAutoFilterTable(getTable, isSetSupported) {
  return async function clearAutoFilterTable(context, action) {
    requireApi(isSetSupported, "1.2", "Table");
    const field = action.args?.[1];
    if (field !== null) validateField(action, 1);
    const table = await getTable(context, action);
    const fields = field === null ? action.column_count : field;
    const first = field === null ? 1 : field;
    for (let fieldIndex = first; fieldIndex <= fields; fieldIndex += 1) {
      table.columns.getItemAt(fieldIndex - 1).filter.clear();
    }
    await context.sync();
  };
}
