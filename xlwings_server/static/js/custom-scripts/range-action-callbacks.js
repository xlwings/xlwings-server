import {
  BORDER_LINE_STYLES,
  BORDER_SIDES,
  BORDER_WEIGHTS,
  conditionalFormatMetadata,
  loadConditionalFormatDetails,
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

function requireConditionalFormats(isSetSupported) {
  if (!isSetSupported("ExcelApi", "1.6")) {
    throw new Error(
      "Conditional formatting requires ExcelApi 1.6 and isn't supported by this Excel host.",
    );
  }
}

const CONDITIONAL_FORMAT_OPERATORS = new Set([
  "Between",
  "NotBetween",
  "EqualTo",
  "NotEqualTo",
  "GreaterThan",
  "LessThan",
  "GreaterThanOrEqual",
  "LessThanOrEqual",
]);
const CONDITIONAL_FORMAT_TYPES = new Set([
  "CellValue",
  "Custom",
  "ColorScale",
  "DataBar",
  "IconSet",
]);
const CONDITIONAL_FORMAT_THRESHOLD_TYPES = new Set([
  "Number",
  "Percent",
  "Percentile",
]);
const CONDITIONAL_FORMAT_CRITERION_TYPES = new Set([
  "Automatic",
  "LowestValue",
  "HighestValue",
  "Number",
  "Percent",
  "Percentile",
]);
const CONDITIONAL_FORMAT_ICON_SETS = new Set([
  "ThreeArrows",
  "ThreeArrowsGray",
  "ThreeFlags",
  "ThreeTrafficLights1",
  "ThreeTrafficLights2",
  "ThreeSigns",
  "ThreeSymbols",
  "ThreeSymbols2",
  "FourArrows",
  "FourArrowsGray",
  "FourRedToBlack",
  "FourRating",
  "FourTrafficLights",
  "FiveArrows",
  "FiveArrowsGray",
  "FiveRating",
  "FiveQuarters",
  "ThreeStars",
  "ThreeTriangles",
  "FiveBoxes",
]);

function validateConditionalFormatColor(value, name) {
  if (
    value != null &&
    (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
  ) {
    throw new Error(`${name} must be #RRGGBB.`);
  }
}

function validateConditionalFormatSpec(spec, { partial = false } = {}) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("Conditional-format specification must be an object.");
  }
  const type = spec.type;
  if (!partial && !CONDITIONAL_FORMAT_TYPES.has(type)) {
    throw new Error(`Unsupported conditional-format type: ${type}`);
  }
  const family = type;
  const commonKeys = new Set([
    "type",
    "fill_color",
    "font_color",
    "font_bold",
    "font_italic",
    "stop_if_true",
  ]);
  const familyKeys =
    {
      CellValue: ["operator", "formula1", "formula2"],
      Custom: ["formula"],
      ColorScale: ["colors", "threshold_types", "thresholds"],
      DataBar: [
        "bar_color",
        "gradient",
        "show_value",
        "threshold_types",
        "thresholds",
      ],
      IconSet: [
        "icon_set",
        "show_value",
        "reverse_order",
        "threshold_types",
        "thresholds",
      ],
    }[family] || [];
  for (const key of Object.keys(spec)) {
    if (!commonKeys.has(key) && !familyKeys.includes(key)) {
      throw new Error(`Invalid ${family} conditional-format field: ${key}`);
    }
  }
  if (family === "CellValue") {
    if (!partial || Object.hasOwn(spec, "operator")) {
      if (!CONDITIONAL_FORMAT_OPERATORS.has(spec.operator)) {
        throw new Error(
          `Invalid conditional-format operator: ${spec.operator}`,
        );
      }
    }
    if (!partial || Object.hasOwn(spec, "formula1")) {
      if (typeof spec.formula1 !== "string" || !spec.formula1) {
        throw new Error("formula1 must be a non-empty string.");
      }
    }
    if (
      Object.hasOwn(spec, "formula2") &&
      spec.formula2 != null &&
      (typeof spec.formula2 !== "string" || !spec.formula2)
    ) {
      throw new Error("formula2 must be a non-empty string or null.");
    }
    if (!partial) {
      const needsFormula2 =
        spec.operator === "Between" || spec.operator === "NotBetween";
      if (needsFormula2 && spec.formula2 == null) {
        throw new Error(`formula2 is required for operator ${spec.operator}.`);
      }
      if (!needsFormula2 && spec.formula2 != null) {
        throw new Error("formula2 is only valid for Between/NotBetween rules.");
      }
    }
  } else if (family === "Custom") {
    if (!partial || Object.hasOwn(spec, "formula")) {
      if (
        typeof spec.formula !== "string" ||
        !spec.formula.startsWith("=") ||
        spec.formula.length < 2
      ) {
        throw new Error(
          "formula must be a non-empty formula starting with '='.",
        );
      }
    }
  } else if (!partial && family === "ColorScale") {
    if (!Array.isArray(spec.colors) || ![2, 3].includes(spec.colors.length)) {
      throw new Error("ColorScale colors must contain two or three colors.");
    }
    spec.colors.forEach((value, index) => {
      if (value == null) throw new Error(`colors[${index}] is required.`);
      validateConditionalFormatColor(value, `colors[${index}]`);
    });
    validateVisualThresholds(spec, spec.colors.length);
  } else if (!partial && family === "DataBar") {
    if (spec.bar_color == null) throw new Error("bar_color is required.");
    validateConditionalFormatColor(spec.bar_color, "bar_color");
    validateVisualThresholds(spec, 2, { allowAutomatic: true });
    for (const name of ["gradient", "show_value"]) {
      if (typeof spec[name] !== "boolean") {
        throw new Error(`${name} must be a boolean.`);
      }
    }
  } else if (!partial && family === "IconSet") {
    if (!CONDITIONAL_FORMAT_ICON_SETS.has(spec.icon_set)) {
      throw new Error(`Invalid conditional-format icon set: ${spec.icon_set}`);
    }
    const count = spec.icon_set.startsWith("Three")
      ? 3
      : spec.icon_set.startsWith("Four")
        ? 4
        : 5;
    validateVisualThresholds(spec, count - 1);
    for (const name of ["show_value", "reverse_order"]) {
      if (typeof spec[name] !== "boolean") {
        throw new Error(`${name} must be a boolean.`);
      }
    }
  }
  if (["ColorScale", "DataBar", "IconSet"].includes(family)) {
    for (const name of [
      "fill_color",
      "font_color",
      "font_bold",
      "font_italic",
      "stop_if_true",
    ]) {
      if (spec[name] != null) {
        throw new Error(`${name} is not valid for ${family} rules.`);
      }
    }
  }
  validateConditionalFormatColor(spec.fill_color, "fill_color");
  validateConditionalFormatColor(spec.font_color, "font_color");
  for (const name of ["font_bold", "font_italic", "stop_if_true"]) {
    if (
      Object.hasOwn(spec, name) &&
      spec[name] != null &&
      typeof spec[name] !== "boolean"
    ) {
      throw new Error(`${name} must be a boolean.`);
    }
  }
}

function validateVisualThresholds(
  spec,
  count,
  { allowAutomatic = false } = {},
) {
  if (
    !Array.isArray(spec.threshold_types) ||
    !Array.isArray(spec.thresholds) ||
    spec.threshold_types.length !== count ||
    spec.thresholds.length !== count
  ) {
    throw new Error(
      `Conditional-format thresholds must contain ${count} entries.`,
    );
  }
  spec.threshold_types.forEach((type, index) => {
    const valid = allowAutomatic
      ? CONDITIONAL_FORMAT_CRITERION_TYPES.has(type)
      : CONDITIONAL_FORMAT_THRESHOLD_TYPES.has(type) ||
        type === "LowestValue" ||
        type === "HighestValue";
    if (!valid) throw new Error(`Invalid threshold type: ${type}`);
    const value = spec.thresholds[index];
    const noValue = ["Automatic", "LowestValue", "HighestValue"].includes(type);
    if (noValue ? value != null : !Number.isFinite(value)) {
      throw new Error(`Invalid threshold value at position ${index}.`);
    }
    if (
      ["Percent", "Percentile"].includes(type) &&
      (value < 0 || value > 100)
    ) {
      throw new Error(
        `Threshold at position ${index} must be between 0 and 100.`,
      );
    }
  });
  const values = spec.thresholds.filter((value) => value != null);
  if (values.some((value, index) => index > 0 && values[index - 1] >= value)) {
    throw new Error(
      "Conditional-format thresholds must be strictly increasing.",
    );
  }
}

function applyConditionalFormat(
  rule,
  type,
  values,
  { mergeExistingRule = true } = {},
) {
  let detail =
    type === "CellValue"
      ? rule.cellValue
      : type === "Custom"
        ? rule.custom
        : null;
  if (
    type === "CellValue" &&
    ["operator", "formula1", "formula2"].some((key) =>
      Object.hasOwn(values, key),
    )
  ) {
    // A newly added Office.js proxy permits assigning rule, but reading it
    // requires load() and context.sync(). Edits have already loaded the rule
    // and need its omitted fields for a partial update.
    const current = mergeExistingRule ? detail.rule || {} : {};
    const operator = values.operator ?? current.operator;
    const next = {
      operator,
      formula1: values.formula1 ?? current.formula1,
    };
    const formula2 = Object.hasOwn(values, "formula2")
      ? values.formula2
      : current.formula2;
    if (operator === "Between" || operator === "NotBetween") {
      next.formula2 = formula2;
    }
    detail.rule = next;
  } else if (type === "Custom" && Object.hasOwn(values, "formula")) {
    // CustomConditionalFormat.rule is a read-only navigation property, while
    // its formula is writable. Unlike CellValueConditionalFormat.rule, the
    // parent rule object itself cannot be replaced.
    detail.rule.formula = values.formula;
  } else if (type === "ColorScale") {
    const criteria = values.colors.map((color, index) => ({
      color,
      type: values.threshold_types[index],
      formula:
        values.thresholds[index] == null
          ? null
          : String(values.thresholds[index]),
    }));
    rule.colorScale.criteria = {
      minimum: criteria[0],
      ...(criteria.length === 3 ? { midpoint: criteria[1] } : {}),
      maximum: criteria.at(-1),
    };
  } else if (type === "DataBar") {
    detail = rule.dataBar;
    const bound = (index) => ({
      type: values.threshold_types[index],
      ...(values.thresholds[index] == null
        ? {}
        : { formula: String(values.thresholds[index]) }),
    });
    detail.lowerBoundRule = bound(0);
    detail.upperBoundRule = bound(1);
    detail.positiveFormat.fillColor = values.bar_color;
    detail.positiveFormat.gradientFill = values.gradient;
    detail.showDataBarOnly = !values.show_value;
    detail = null;
  } else if (type === "IconSet") {
    detail = rule.iconSet;
    detail.style = values.icon_set;
    detail.showIconOnly = !values.show_value;
    detail.reverseIconOrder = values.reverse_order;
    detail.criteria = [
      { type: "Percent", operator: "GreaterThanOrEqual", formula: "0" },
      ...values.thresholds.map((value, index) => ({
        type: values.threshold_types[index],
        operator: "GreaterThanOrEqual",
        formula: String(value),
      })),
    ];
    detail = null;
  }
  if (detail && values.fill_color != null)
    detail.format.fill.color = values.fill_color;
  if (detail && values.font_color != null)
    detail.format.font.color = values.font_color;
  if (detail && values.font_bold != null)
    detail.format.font.bold = values.font_bold;
  if (detail && values.font_italic != null)
    detail.format.font.italic = values.font_italic;
  if (values.stop_if_true != null) rule.stopIfTrue = values.stop_if_true;
}

function conditionalFormatMetadataValueEqual(actual, expected) {
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) =>
        conditionalFormatMetadataValueEqual(value, expected[index]),
      )
    );
  }
  return (actual ?? null) === (expected ?? null);
}

function conditionalFormatMetadataMatches(actual, expected) {
  return Object.entries(expected).every(([key, value]) =>
    conditionalFormatMetadataValueEqual(actual[key], value),
  );
}

export function createAddConditionalFormat(getRange, isSetSupported) {
  return async function addConditionalFormat(context, action) {
    requireConditionalFormats(isSetSupported);
    const [spec] = action.args || [];
    validateConditionalFormatSpec(spec);
    const range = await getRange(context, action);
    const rule = range.conditionalFormats.add(spec.type);
    applyConditionalFormat(rule, spec.type, spec, {
      mergeExistingRule: false,
    });
    // The public API guarantees highest-priority insertion. Office.js
    // documents add() that way, but assign it explicitly as well so collection
    // order stays deterministic across hosts.
    rule.priority = 0;
    await context.sync();
  };
}

export function createSetConditionalFormat(getRange, isSetSupported) {
  return async function setConditionalFormat(context, action) {
    requireConditionalFormats(isSetSupported);
    const [position, expected, changes] = action.args || [];
    if (!Number.isSafeInteger(position) || position < 0) {
      throw new Error(`Invalid conditional-format position: ${position}`);
    }
    if (!expected || !["CellValue", "Custom"].includes(expected.type)) {
      throw new Error("A supported conditional-format snapshot is required.");
    }
    validateConditionalFormatSpec(
      { ...changes, type: expected.type },
      { partial: true },
    );
    const range = await getRange(context, action);
    const rule = range.conditionalFormats.getItemAt(position);
    rule.load("type,stopIfTrue");
    await context.sync();
    if (rule.type !== expected.type) {
      throw new Error(
        `Conditional-format rule at position ${position} changed since it was read.`,
      );
    }
    if (loadConditionalFormatDetails([rule])) await context.sync();
    const actual = conditionalFormatMetadata([rule])[0];
    const unchanged = conditionalFormatMetadataMatches(actual, expected);
    if (!unchanged) {
      throw new Error(
        `Conditional-format rule at position ${position} changed since it was read.`,
      );
    }
    validateConditionalFormatSpec(
      { ...actual, ...changes, type: expected.type },
      { partial: false },
    );
    applyConditionalFormat(rule, expected.type, changes);
    await context.sync();
  };
}

export function createClearConditionalFormats(getRange, isSetSupported) {
  return async function clearConditionalFormats(context, action) {
    requireConditionalFormats(isSetSupported);
    const range = await getRange(context, action);
    range.conditionalFormats.clearAll();
    await context.sync();
  };
}

export function createDeleteConditionalFormat(getRange, isSetSupported) {
  return async function deleteConditionalFormat(context, action) {
    requireConditionalFormats(isSetSupported);
    const [position, expected] = action.args || [];
    if (!Number.isSafeInteger(position) || position < 0) {
      throw new Error(`Invalid conditional-format position: ${position}`);
    }
    if (!expected || typeof expected.type !== "string") {
      throw new Error("A conditional-format snapshot is required.");
    }
    const range = await getRange(context, action);
    const rule = range.conditionalFormats.getItemAt(position);
    rule.load("type,stopIfTrue");
    await context.sync();
    if (rule.type !== expected.type) {
      throw new Error(
        `Conditional-format rule at position ${position} changed since it was read.`,
      );
    }
    if (loadConditionalFormatDetails([rule])) await context.sync();
    const actual = conditionalFormatMetadata([rule])[0];
    if (!conditionalFormatMetadataMatches(actual, expected)) {
      throw new Error(
        `Conditional-format rule at position ${position} changed since it was read.`,
      );
    }
    rule.delete();
    await context.sync();
  };
}
