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

function formattedDateValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") {
    throw new Error(
      "AutoFilter comparison values must be strings, dates, or null.",
    );
  }
  const match = String(value.value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?))?$/,
  );
  if (
    !["date", "datetime"].includes(value.type) ||
    !match ||
    (value.type === "date" && match[4] !== undefined) ||
    (value.type === "datetime" && match[4] === undefined)
  ) {
    throw new Error("Invalid AutoFilter date comparison value.");
  }
  const [, yearText, monthText, dayText, hour, minute, second] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    (value.type === "datetime" &&
      (Number(hour) > 23 || Number(minute) > 59 || Number(second) >= 60))
  ) {
    throw new Error("Invalid AutoFilter date comparison value.");
  }
  const date = `${String(month)}/${String(day)}/${String(year)}`;
  return value.type === "datetime"
    ? `${date} ${String(Number(hour))}:${String(Number(minute))}:${second}`
    : date;
}

function comparisonCriteria(spec) {
  if (!Object.hasOwn(COMPARISON_PREFIXES, spec.operator)) {
    if (!["between", "not_between"].includes(spec.operator)) {
      throw new Error(
        `Unknown AutoFilter comparison operator: ${spec.operator}.`,
      );
    }
  }
  if (spec.value1 == null) {
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
  const first = escapeCustomFilterValue(formattedDateValue(spec.value1));
  if (["between", "not_between"].includes(spec.operator)) {
    if (spec.value2 == null) {
      throw new Error(`${spec.operator} requires value2.`);
    }
    const second = escapeCustomFilterValue(formattedDateValue(spec.value2));
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
  if (["top_items", "bottom_items"].includes(spec.type)) {
    if (!Number.isInteger(spec.value) || spec.value < 1 || spec.value > 255) {
      throw new Error("AutoFilter item count must be between 1 and 255.");
    }
    return {
      filterOn: spec.type === "top_items" ? "TopItems" : "BottomItems",
      criterion1: String(spec.value),
    };
  }
  if (["top_percent", "bottom_percent"].includes(spec.type)) {
    if (!Number.isFinite(spec.value) || spec.value < 0 || spec.value > 100) {
      throw new Error("AutoFilter percent must be between 0 and 100.");
    }
    return {
      filterOn: spec.type === "top_percent" ? "TopPercent" : "BottomPercent",
      criterion1: String(spec.value),
    };
  }
  throw new Error(`Unknown AutoFilter criteria type: ${String(spec.type)}.`);
}

function normalizedAddress(address) {
  return String(address).split("!").at(-1).replaceAll("$", "").toUpperCase();
}

export function emptyAutoFilterCriteria(field, type = "none") {
  return {
    field,
    type,
    values: null,
    operator: null,
    value1: null,
    value2: null,
    count: null,
    percent: null,
  };
}

function unescapeCustomFilterValue(value) {
  return value.replaceAll(/~([~*?])/g, "$1");
}

function splitComparison(value) {
  if (typeof value !== "string") return [null, null];
  for (const prefix of [">=", "<=", "<>", ">", "<", "="]) {
    if (value.startsWith(prefix)) {
      const operand = value.slice(prefix.length);
      return [prefix, operand ? unescapeCustomFilterValue(operand) : null];
    }
  }
  return ["=", unescapeCustomFilterValue(value)];
}

function normalizedValueFilter(values) {
  let normalized;
  try {
    normalized = values == null ? null : Array.from(values);
  } catch {
    return null;
  }
  return normalized?.every((value) => typeof value === "string")
    ? normalized
    : null;
}

export function normalizeAutoFilterCriteria(field, criteria) {
  const filterOn = String(criteria?.filterOn ?? "").toLowerCase();
  const type = {
    values: "values",
    custom: "comparison",
    topitems: "top_items",
    bottomitems: "bottom_items",
    toppercent: "top_percent",
    bottompercent: "bottom_percent",
  }[filterOn];
  if (!filterOn) {
    return emptyAutoFilterCriteria(field);
  }
  if (filterOn === "unknown") {
    const values = normalizedValueFilter(criteria.values);
    if (values?.length) {
      const snapshot = emptyAutoFilterCriteria(field, "values");
      snapshot.values = values;
      return snapshot;
    }
    return emptyAutoFilterCriteria(field, "unknown");
  }
  if (!type) return emptyAutoFilterCriteria(field, "unknown");
  const snapshot = emptyAutoFilterCriteria(field, type);
  if (type === "values") {
    const values = normalizedValueFilter(criteria.values);
    if (values?.length === 0) return emptyAutoFilterCriteria(field);
    if (!values) {
      return emptyAutoFilterCriteria(field, "unknown");
    }
    snapshot.values = values;
    return snapshot;
  }
  if (["top_items", "bottom_items"].includes(type)) {
    if (/^[<>]/.test(String(criteria.criterion1))) return snapshot;
    const count = Number(criteria.criterion1);
    if (!Number.isInteger(count) || count < 1 || count > 255) {
      return emptyAutoFilterCriteria(field, "unknown");
    }
    snapshot.count = count;
    return snapshot;
  }
  if (["top_percent", "bottom_percent"].includes(type)) {
    if (/^[<>]/.test(String(criteria.criterion1))) return snapshot;
    const percent = Number(criteria.criterion1);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return emptyAutoFilterCriteria(field, "unknown");
    }
    snapshot.percent = percent;
    return snapshot;
  }

  if (criteria.criterion1 == null) {
    return emptyAutoFilterCriteria(field);
  }

  const [prefix1, value1] = splitComparison(criteria.criterion1);
  const [prefix2, value2] = splitComparison(criteria.criterion2);
  let operator;
  if (criteria.criterion2 != null) {
    const join = String(criteria.operator ?? "").toLowerCase();
    if (join === "and" && prefix1 === ">=" && prefix2 === "<=") {
      operator = "between";
    } else if (join === "or" && prefix1 === "<" && prefix2 === ">") {
      operator = "not_between";
    } else {
      return emptyAutoFilterCriteria(field, "unknown");
    }
  } else {
    operator = {
      "=": "equal_to",
      "<>": "not_equal_to",
      ">": "greater_than",
      "<": "less_than",
      ">=": "greater_than_or_equal",
      "<=": "less_than_or_equal",
    }[prefix1];
    if (!operator) return emptyAutoFilterCriteria(field, "unknown");
  }
  snapshot.operator = operator;
  snapshot.value1 = value1;
  snapshot.value2 = value2;
  return snapshot;
}

export function createGetAutoFilterCriteria(excelRun, isSetSupported) {
  return async function getAutoFilterCriteria(
    sheetName,
    address,
    tableIndex = null,
  ) {
    return await excelRun(async (context) => {
      const sheet = context.workbook.worksheets.getItem(sheetName);
      if (tableIndex !== null) {
        requireApi(isSetSupported, "1.2", "Table");
        const table = sheet.tables.getItemAt(tableIndex);
        const columns = table.columns.load("items");
        await context.sync();
        const filters = columns.items.map((column) =>
          column.filter.load("criteria"),
        );
        await context.sync();
        return filters.map((filter, index) =>
          normalizeAutoFilterCriteria(index + 1, filter.criteria),
        );
      }

      requireApi(isSetSupported, "1.9", "Range");
      const range = sheet.getRange(address).load("address,columnCount");
      const filteredRange = sheet.autoFilter
        .getRangeOrNullObject()
        .load("address");
      sheet.autoFilter.load("criteria");
      await context.sync();
      if (
        filteredRange.isNullObject ||
        normalizedAddress(filteredRange.address) !==
          normalizedAddress(range.address)
      ) {
        return Array.from({ length: range.columnCount }, (_, index) =>
          emptyAutoFilterCriteria(index + 1),
        );
      }
      return Array.from({ length: range.columnCount }, (_, index) =>
        normalizeAutoFilterCriteria(
          index + 1,
          sheet.autoFilter.criteria[index],
        ),
      );
    });
  };
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
    } else if (spec.type === "comparison") {
      filter.applyCustomFilter(
        criteria.criterion1,
        criteria.criterion2,
        criteria.operator,
      );
    } else {
      ({
        top_items: filter.applyTopItemsFilter.bind(filter),
        bottom_items: filter.applyBottomItemsFilter.bind(filter),
        top_percent: filter.applyTopPercentFilter.bind(filter),
        bottom_percent: filter.applyBottomPercentFilter.bind(filter),
      })[spec.type](spec.value);
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
