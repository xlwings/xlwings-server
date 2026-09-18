import {
  BORDER_LINE_STYLES,
  BORDER_SIDES,
  BORDER_WEIGHTS,
} from "./workbook-metadata.js";

export function createSetValues(getRange) {
  return async function setValues(context, action) {
    const range = await getRange(context, action);
    range.values = action.values;
    await context.sync();
  };
}

export function createSetFormula(getRange) {
  return async function setFormula(context, action) {
    const range = await getRange(context, action);
    // The remote Python protocol has always named the formula matrix `values`.
    range.formulas = action.values;
    await context.sync();
  };
}

export function createSetFormulaArray(getRange, isSetSupported) {
  return async function setFormulaArray(context, action) {
    if (!isSetSupported("ExcelApiDesktop", "1.1")) {
      throw new Error(
        "formula_array requires ExcelApiDesktop 1.1 and isn't supported by this Excel host.",
      );
    }
    const range = await getRange(context, action);
    range.formulaArray = action.args[0].toString();
    await context.sync();
  };
}

export function createSetColumnWidth(getRange) {
  return async function setColumnWidth(context, action) {
    // Points, which is what Office.js' RangeFormat.columnWidth takes. The
    // desktop engines pass COM's raw value through the same way; there it
    // happens to be characters.
    const points = action.args[0];
    if (!Number.isFinite(points) || points < 0) {
      throw new Error("column_width must be a non-negative number.");
    }
    const range = await getRange(context, action);
    range.format.columnWidth = points;
    await context.sync();
  };
}

function requireDataValidationApi(isSetSupported) {
  if (!isSetSupported("ExcelApi", "1.8")) {
    throw new Error(
      "data_validation requires ExcelApi 1.8 and isn't supported by this Excel host.",
    );
  }
}

const DATA_VALIDATION_OPERATORS = Object.freeze({
  between: "Between",
  not_between: "NotBetween",
  equal_to: "EqualTo",
  not_equal_to: "NotEqualTo",
  greater_than: "GreaterThan",
  less_than: "LessThan",
  greater_than_or_equal: "GreaterThanOrEqualTo",
  less_than_or_equal: "LessThanOrEqualTo",
});

const DATA_VALIDATION_RULE_KEYS = Object.freeze({
  whole_number: "wholeNumber",
  decimal: "decimal",
  date: "date",
  time: "time",
  text_length: "textLength",
});

const DATA_VALIDATION_TYPES = Object.freeze({
  None: "none",
  WholeNumber: "whole_number",
  Decimal: "decimal",
  List: "list",
  Date: "date",
  Time: "time",
  TextLength: "text_length",
  Custom: "custom",
  Inconsistent: "inconsistent",
  MixedCriteria: "mixed_criteria",
});

const DATA_VALIDATION_ALERT_STYLES = Object.freeze({
  Stop: "stop",
  Warning: "warning",
  Information: "information",
});

function emptyDataValidationSnapshot(type) {
  return {
    type,
    operator: null,
    formula1: null,
    formula2: null,
    formula: null,
    source: null,
    in_cell_dropdown: null,
    ignore_blank: null,
    input_title: null,
    input_message: null,
    show_input: null,
    error_title: null,
    error_message: null,
    show_error: null,
    alert_style: null,
  };
}

function normalizedDataValidationType(type) {
  return DATA_VALIDATION_TYPES[type] ?? "unknown";
}

function ensureUniformDataValidation(type) {
  if (type === "Inconsistent" || type === "MixedCriteria") {
    throw new Error(
      "Cannot update data validation because the target cells have different validation rules.",
    );
  }
}

async function loadDataValidationType(context, range) {
  const validation = range.dataValidation;
  validation.load("type");
  await context.sync();
  return validation;
}

export async function readDataValidation(context, range, isSetSupported) {
  requireDataValidationApi(isSetSupported);
  const validation = await loadDataValidationType(context, range);
  const type = normalizedDataValidationType(validation.type);
  const snapshot = emptyDataValidationSnapshot(type);
  if (["none", "inconsistent", "mixed_criteria"].includes(type)) {
    return snapshot;
  }

  validation.load(["rule", "ignoreBlanks", "prompt", "errorAlert"]);
  await context.sync();
  const rule = validation.rule ?? {};
  const prompt = validation.prompt ?? {};
  const errorAlert = validation.errorAlert ?? {};
  snapshot.ignore_blank = validation.ignoreBlanks ?? null;
  snapshot.input_title = prompt.title ?? null;
  snapshot.input_message = prompt.message ?? null;
  snapshot.show_input = prompt.showPrompt ?? null;
  snapshot.error_title = errorAlert.title ?? null;
  snapshot.error_message = errorAlert.message ?? null;
  snapshot.show_error = errorAlert.showAlert ?? null;
  snapshot.alert_style = DATA_VALIDATION_ALERT_STYLES[errorAlert.style] ?? null;

  if (type === "list") {
    snapshot.source = rule.list?.source ?? null;
    snapshot.in_cell_dropdown = rule.list?.inCellDropDown ?? null;
  } else if (type === "custom") {
    snapshot.formula = rule.custom?.formula ?? null;
  } else {
    const criteria = rule[DATA_VALIDATION_RULE_KEYS[type]] ?? {};
    snapshot.operator =
      Object.entries(DATA_VALIDATION_OPERATORS).find(
        ([, officeValue]) => officeValue === criteria.operator,
      )?.[0] ?? null;
    snapshot.formula1 = criteria.formula1 ?? null;
    snapshot.formula2 = criteria.formula2 ?? null;
  }
  return snapshot;
}

function dataValidationComparisonRule(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Data validation rule must be an object.");
  }
  const officeKey = DATA_VALIDATION_RULE_KEYS[spec.type];
  if (!officeKey) {
    throw new Error(`Unknown data validation rule type: ${spec.type}`);
  }
  const operator = DATA_VALIDATION_OPERATORS[spec.operator];
  if (!operator) {
    throw new Error(`Unknown data validation operator: ${spec.operator}`);
  }
  if (typeof spec.formula1 !== "string" || spec.formula1.length === 0) {
    throw new Error("Data validation formula1 must be a non-empty string.");
  }
  if (spec.formula1.length > 255) {
    throw new Error("Data validation formula1 cannot exceed 255 characters.");
  }
  const needsFormula2 = ["between", "not_between"].includes(spec.operator);
  if (needsFormula2) {
    if (typeof spec.formula2 !== "string" || spec.formula2.length === 0) {
      throw new Error(`formula2 is required for operator ${spec.operator}.`);
    }
    if (spec.formula2.length > 255) {
      throw new Error("Data validation formula2 cannot exceed 255 characters.");
    }
  } else if (spec.formula2 != null) {
    throw new Error(`formula2 isn't valid for operator ${spec.operator}.`);
  }
  return {
    [officeKey]: {
      operator,
      formula1: spec.formula1,
      ...(needsFormula2 ? { formula2: spec.formula2 } : {}),
    },
  };
}

function dataValidationRule(spec) {
  if (spec?.type === "custom") {
    if (
      typeof spec.formula1 !== "string" ||
      !spec.formula1.startsWith("=") ||
      spec.formula1.length < 2 ||
      spec.formula1.length > 255 ||
      spec.operator != null ||
      spec.formula2 != null
    ) {
      throw new Error(
        "Custom data validation requires one A1 formula of at most 255 characters.",
      );
    }
    return { custom: { formula: spec.formula1 } };
  }
  return dataValidationComparisonRule(spec);
}

async function dataValidationListSource(context, payload, getSheet) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Data validation list source must be an object.");
  }
  switch (payload.type) {
    case "literal": {
      if (
        !Array.isArray(payload.values) ||
        payload.values.length === 0 ||
        payload.values.some(
          (value) =>
            typeof value !== "string" ||
            value.includes(",") ||
            value.includes(";"),
        )
      ) {
        throw new Error(
          "Literal data validation values must be a non-empty array of strings without separators.",
        );
      }
      const source = payload.values.join(",");
      if (source.length > 255) {
        throw new Error(
          "A literal data validation source cannot exceed 255 characters.",
        );
      }
      return source;
    }
    case "range": {
      const fields = [
        payload.sheet_position,
        payload.start_row,
        payload.start_column,
        payload.row_count,
        payload.column_count,
      ];
      if (
        fields.some((value) => !Number.isInteger(value)) ||
        payload.sheet_position < 0 ||
        payload.start_row < 0 ||
        payload.start_column < 0 ||
        payload.row_count < 1 ||
        payload.column_count < 1 ||
        (payload.row_count !== 1 && payload.column_count !== 1)
      ) {
        throw new Error(
          "Data validation range sources must contain valid one-dimensional coordinates.",
        );
      }
      const sheet = await getSheet(context, payload.sheet_position);
      return sheet.getRangeByIndexes(
        payload.start_row,
        payload.start_column,
        payload.row_count,
        payload.column_count,
      );
    }
    case "name":
      if (typeof payload.name !== "string" || payload.name.length === 0) {
        throw new Error("Data validation named sources require a name.");
      }
      return `=${payload.name}`;
    default:
      throw new Error(`Unknown data validation list source: ${payload.type}`);
  }
}

export function createSetDataValidationList(
  getRange,
  getSheet,
  isSetSupported,
) {
  return async function setDataValidationList(context, action) {
    requireDataValidationApi(isSetSupported);
    const [sourcePayload, inCellDropdown] = action.args ?? [];
    if (typeof inCellDropdown !== "boolean") {
      throw new Error("in_cell_dropdown must be a boolean.");
    }
    const source = await dataValidationListSource(
      context,
      sourcePayload,
      getSheet,
    );
    const range = await getRange(context, action);
    const validation = await loadDataValidationType(context, range);
    ensureUniformDataValidation(validation.type);
    // Assigning only the rule preserves ignoreBlanks, prompt and errorAlert.
    validation.rule = {
      list: { source, inCellDropDown: inCellDropdown },
    };
    await context.sync();
  };
}

export function createSetDataValidationRule(getRange, isSetSupported) {
  return async function setDataValidationRule(context, action) {
    requireDataValidationApi(isSetSupported);
    const rule = dataValidationRule(action.args?.[0]);
    const range = await getRange(context, action);
    const validation = await loadDataValidationType(context, range);
    ensureUniformDataValidation(validation.type);
    // Assigning only the rule preserves ignoreBlanks, prompt and errorAlert.
    validation.rule = rule;
    await context.sync();
  };
}

export function createDeleteDataValidation(getRange, isSetSupported) {
  return async function deleteDataValidation(context, action) {
    requireDataValidationApi(isSetSupported);
    const range = await getRange(context, action);
    range.dataValidation.clear();
    await context.sync();
  };
}

function officeBorderValue(mapping, value, what) {
  if (!Object.prototype.hasOwnProperty.call(mapping, value)) {
    throw new Error(`Unknown border ${what}: ${value}`);
  }
  return mapping[value];
}

export function createSetBorderProperty(getRange) {
  // One action per side and attribute, see xlwings.pro._xlremote.Border. The
  // Python side validates and sends its snake_case vocabulary; anything else
  // here is a protocol mismatch and fails before touching the range. Combined
  // writes arrive as separate actions already in the documented color,
  // weight, line-style order, so nothing needs reordering.
  return async function setBorderProperty(context, action) {
    const [side, attribute, value] = action.args;
    const sideIndex = officeBorderValue(BORDER_SIDES, side, "side");
    let property;
    let officeValue;
    switch (attribute) {
      case "line_style":
        property = "style";
        // null is how Python asks for the border to be removed. Lite hands
        // the actions over via Pyodide's to_js(), which turns None into
        // undefined rather than null, so check loosely.
        officeValue =
          value == null
            ? BORDER_LINE_STYLES.none
            : officeBorderValue(BORDER_LINE_STYLES, value, "line style");
        break;
      case "weight":
        property = "weight";
        officeValue = officeBorderValue(BORDER_WEIGHTS, value, "weight");
        break;
      case "color":
        property = "color";
        if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
          throw new Error(`Border color must be #RRGGBB, not ${value}`);
        }
        officeValue = value;
        break;
      default:
        throw new Error(`Unknown border attribute: ${attribute}`);
    }
    const range = await getRange(context, action);
    range.format.borders.getItem(sideIndex)[property] = officeValue;
    await context.sync();
  };
}
