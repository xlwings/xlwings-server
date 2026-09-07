import {
  BORDER_LINE_STYLES,
  BORDER_SIDES,
  BORDER_WEIGHTS,
} from "./workbook-metadata.js";

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
  // writes arrive as separate actions already in the documented colour,
  // weight, line-style order, so nothing needs reordering.
  return async function setBorderProperty(context, action) {
    const [side, attribute, value] = action.args;
    const sideIndex = officeBorderValue(BORDER_SIDES, side, "side");
    let property;
    let officeValue;
    switch (attribute) {
      case "line_style":
        property = "style";
        // null is how Python asks for the border to be removed
        officeValue =
          value === null
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
