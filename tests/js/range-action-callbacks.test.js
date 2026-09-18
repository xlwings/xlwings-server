import { describe, expect, it, vi } from "vitest";

import {
  createDeleteDataValidation,
  createSetBorderProperty,
  createSetColumnWidth,
  createSetDataValidationList,
  createSetDataValidationRule,
  createSetFormula,
  createSetFormulaArray,
  createSetValues,
  readDataValidation,
} from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";
import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";

describe("setValues action callback", () => {
  it("awaits a separate sync for each write before dispatching the next", async () => {
    const ranges = [{}, {}, {}];
    const actions = ranges.map((_, index) => ({
      func: "setValues",
      start_row: index,
      values: [[index]],
    }));
    const pendingSyncs = [];
    const context = {
      sync: vi.fn(() => new Promise((resolve) => pendingSyncs.push(resolve))),
    };
    const getRange = vi.fn(async (_, action) => ranges[action.start_row]);
    let completed = false;
    const execution = dispatchActions(actions, context, {
      setValues: createSetValues(getRange),
    }).then(() => {
      completed = true;
    });

    for (let index = 0; index < actions.length; index++) {
      await vi.waitFor(() => {
        expect(context.sync).toHaveBeenCalledTimes(index + 1);
      });
      expect(getRange).toHaveBeenCalledTimes(index + 1);
      expect(getRange).toHaveBeenLastCalledWith(context, actions[index]);
      expect(ranges[index].values).toEqual(actions[index].values);
      expect(completed).toBe(false);
      if (index + 1 < ranges.length) {
        expect(ranges[index + 1].values).toBeUndefined();
      }
      pendingSyncs[index]();
    }

    await execution;
    expect(completed).toBe(true);
    expect(context.sync).toHaveBeenCalledTimes(3);
  });
});

describe("setFormula action callback", () => {
  it("writes the formula matrix and synchronizes the request context", async () => {
    const range = {};
    const context = { sync: vi.fn(async () => {}) };
    const getRange = vi.fn(async () => range);
    const setFormula = createSetFormula(getRange);
    const action = { values: [["=SUM(A1:A2)"]] };

    await setFormula(context, action);

    expect(getRange).toHaveBeenCalledWith(context, action);
    expect(range.formulas).toEqual([["=SUM(A1:A2)"]]);
    expect(context.sync).toHaveBeenCalledOnce();
  });
});

describe("setFormulaArray action callback", () => {
  it("writes a CSE formula to the full target range on supported hosts", async () => {
    const range = {};
    const context = { sync: vi.fn(async () => {}) };
    const getRange = vi.fn(async () => range);
    const setFormulaArray = createSetFormulaArray(getRange, () => true);
    const action = { args: ["=SUM(A1:A3*B1:B3)"] };

    await setFormulaArray(context, action);

    expect(range.formulaArray).toBe("=SUM(A1:A3*B1:B3)");
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it("rejects hosts without the desktop array-formula API", async () => {
    const getRange = vi.fn();
    const setFormulaArray = createSetFormulaArray(getRange, () => false);

    await expect(
      setFormulaArray({ sync: vi.fn() }, { args: ["=SUM(A1:A3)"] }),
    ).rejects.toThrow("ExcelApiDesktop 1.1");
    expect(getRange).not.toHaveBeenCalled();
  });
});

describe("setColumnWidth action callback", () => {
  function harness() {
    const format = {};
    const range = { format };
    return {
      range,
      format,
      getRange: vi.fn(async () => range),
      context: { sync: vi.fn(async () => {}) },
    };
  }

  it("writes the width straight through as points", async () => {
    // Office.js' RangeFormat.columnWidth is points, and that's the raw
    // measure xlwings passes on this engine -- no unit conversion either way.
    const { format, getRange, context } = harness();
    const setColumnWidth = createSetColumnWidth(getRange);

    await setColumnWidth(context, { args: [110.5] });

    expect(format.columnWidth).toBe(110.5);
    expect(context.sync).toHaveBeenCalled();
  });

  it("preserves zero, which hides the column", async () => {
    const { format, getRange, context } = harness();
    await createSetColumnWidth(getRange)(context, { args: [0] });
    expect(format.columnWidth).toBe(0);
  });

  it("rejects invalid widths before touching the range", async () => {
    for (const value of [-1, NaN, Infinity, null, "wide"]) {
      const { format, getRange, context } = harness();
      await expect(
        createSetColumnWidth(getRange)(context, { args: [value] }),
      ).rejects.toThrow("column_width must be a non-negative number.");
      expect(getRange).not.toHaveBeenCalled();
      expect(format.columnWidth).toBeUndefined();
    }
  });
});

describe("data validation action callbacks", () => {
  function harness() {
    const dataValidation = {
      type: "WholeNumber",
      rule: { wholeNumber: { formula1: 1 } },
      ignoreBlanks: false,
      prompt: { showPrompt: true, title: "Choose", message: "Pick one" },
      errorAlert: {
        showAlert: true,
        style: "Stop",
        title: "Invalid",
        message: "Use the list",
      },
      clear: vi.fn(),
      load: vi.fn(() => dataValidation),
    };
    const target = { dataValidation };
    const sourceRange = { address: "$C$2:$C$4" };
    const sourceSheet = {
      getRangeByIndexes: vi.fn(() => sourceRange),
    };
    const getSheet = vi.fn(async () => sourceSheet);
    return {
      dataValidation,
      target,
      sourceRange,
      sourceSheet,
      getSheet,
      getRange: vi.fn(async () => target),
      context: {
        sync: vi.fn(async () => {}),
      },
    };
  }

  it("sets a literal list while preserving prompts, alerts and ignoreBlanks", async () => {
    const h = harness();
    const prompt = h.dataValidation.prompt;
    const errorAlert = h.dataValidation.errorAlert;
    const setList = createSetDataValidationList(
      h.getRange,
      h.getSheet,
      () => true,
    );

    await setList(h.context, {
      args: [{ type: "literal", values: ["Open", "Closed"] }, false],
    });

    expect(h.dataValidation.rule).toEqual({
      list: { source: "Open,Closed", inCellDropDown: false },
    });
    expect(h.dataValidation.prompt).toBe(prompt);
    expect(h.dataValidation.errorAlert).toBe(errorAlert);
    expect(h.dataValidation.ignoreBlanks).toBe(false);
    expect(h.context.sync).toHaveBeenCalledTimes(2);
  });

  it("uses a worksheet Range as the list source", async () => {
    const h = harness();
    const setList = createSetDataValidationList(
      h.getRange,
      h.getSheet,
      () => true,
    );

    await setList(h.context, {
      args: [
        {
          type: "range",
          sheet_position: 1,
          start_row: 1,
          start_column: 2,
          row_count: 3,
          column_count: 1,
        },
        true,
      ],
    });

    expect(h.getSheet).toHaveBeenCalledWith(h.context, 1);
    expect(h.sourceSheet.getRangeByIndexes).toHaveBeenCalledWith(1, 2, 3, 1);
    expect(h.dataValidation.rule).toEqual({
      list: { source: h.sourceRange, inCellDropDown: true },
    });
  });

  it("uses a defined name as the list source", async () => {
    const h = harness();
    const setList = createSetDataValidationList(
      h.getRange,
      h.getSheet,
      () => true,
    );

    await setList(h.context, {
      args: [{ type: "name", name: "Statuses" }, true],
    });

    expect(h.dataValidation.rule.list.source).toBe("=Statuses");
  });

  it.each(["Inconsistent", "MixedCriteria"])(
    "does not overwrite a %s target with a list rule",
    async (type) => {
      const h = harness();
      h.dataValidation.type = type;
      const originalRule = h.dataValidation.rule;
      await expect(
        createSetDataValidationList(
          h.getRange,
          h.getSheet,
          () => true,
        )(h.context, { args: [{ type: "literal", values: ["Open"] }, true] }),
      ).rejects.toThrow("different validation rules");
      expect(h.dataValidation.rule).toBe(originalRule);
      expect(h.context.sync).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["whole_number", "wholeNumber", "between", "Between", "1", "10"],
    ["decimal", "decimal", "greater_than", "GreaterThan", "0.5", null],
    [
      "date",
      "date",
      "greater_than_or_equal",
      "GreaterThanOrEqualTo",
      "=46023",
      null,
    ],
    ["time", "time", "less_than", "LessThan", "=0.5", null],
    [
      "text_length",
      "textLength",
      "less_than_or_equal",
      "LessThanOrEqualTo",
      "40",
      null,
    ],
  ])(
    "sets a %s rule while preserving surrounding settings",
    async (type, officeKey, operator, officeOperator, formula1, formula2) => {
      const h = harness();
      const prompt = h.dataValidation.prompt;
      const errorAlert = h.dataValidation.errorAlert;
      const setRule = createSetDataValidationRule(h.getRange, () => true);

      await setRule(h.context, {
        args: [{ type, operator, formula1, formula2 }],
      });

      expect(h.dataValidation.rule).toEqual({
        [officeKey]: {
          operator: officeOperator,
          formula1,
          ...(formula2 == null ? {} : { formula2 }),
        },
      });
      expect(h.dataValidation.prompt).toBe(prompt);
      expect(h.dataValidation.errorAlert).toBe(errorAlert);
      expect(h.dataValidation.ignoreBlanks).toBe(false);
      expect(h.context.sync).toHaveBeenCalledTimes(2);
    },
  );

  it("sets a custom-formula rule", async () => {
    const h = harness();
    await createSetDataValidationRule(h.getRange, () => true)(h.context, {
      args: [
        {
          type: "custom",
          operator: null,
          formula1: "=COUNTIF(A:A,A1)=1",
          formula2: null,
        },
      ],
    });
    expect(h.dataValidation.rule).toEqual({
      custom: { formula: "=COUNTIF(A:A,A1)=1" },
    });
  });

  it.each([
    [
      { type: "unknown", operator: "between", formula1: "1", formula2: "2" },
      "Unknown data validation rule type",
    ],
    [
      { type: "decimal", operator: "unknown", formula1: "1", formula2: null },
      "Unknown data validation operator",
    ],
    [
      { type: "decimal", operator: "between", formula1: "1", formula2: null },
      "formula2 is required",
    ],
    [
      {
        type: "decimal",
        operator: "greater_than",
        formula1: "1",
        formula2: "2",
      },
      "formula2 isn't valid",
    ],
    [
      { type: "custom", operator: null, formula1: "A1>0", formula2: null },
      "Custom data validation",
    ],
  ])(
    "rejects an invalid generic rule before touching the range",
    async (spec, message) => {
      const h = harness();
      await expect(
        createSetDataValidationRule(h.getRange, () => true)(h.context, {
          args: [spec],
        }),
      ).rejects.toThrow(message);
      expect(h.getRange).not.toHaveBeenCalled();
      expect(h.context.sync).not.toHaveBeenCalled();
    },
  );

  it.each(["Inconsistent", "MixedCriteria"])(
    "does not overwrite a %s target",
    async (type) => {
      const h = harness();
      h.dataValidation.type = type;
      const originalRule = h.dataValidation.rule;
      await expect(
        createSetDataValidationRule(h.getRange, () => true)(h.context, {
          args: [
            {
              type: "decimal",
              operator: "greater_than",
              formula1: "0",
              formula2: null,
            },
          ],
        }),
      ).rejects.toThrow("different validation rules");
      expect(h.dataValidation.rule).toBe(originalRule);
      expect(h.context.sync).toHaveBeenCalledOnce();
    },
  );

  it("reads a complete normalized validation snapshot", async () => {
    const h = harness();
    h.dataValidation.rule = {
      wholeNumber: {
        operator: "Between",
        formula1: "=1",
        formula2: "=10",
      },
    };
    expect(await readDataValidation(h.context, h.target, () => true)).toEqual({
      type: "whole_number",
      operator: "between",
      formula1: "=1",
      formula2: "=10",
      formula: null,
      source: null,
      in_cell_dropdown: null,
      ignore_blank: false,
      input_title: "Choose",
      input_message: "Pick one",
      show_input: true,
      error_title: "Invalid",
      error_message: "Use the list",
      show_error: true,
      alert_style: "stop",
    });
    expect(h.context.sync).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["None", "none"],
    ["MixedCriteria", "mixed_criteria"],
    ["Inconsistent", "inconsistent"],
  ])("reads %s without trying to load one rule", async (officeType, type) => {
    const h = harness();
    h.dataValidation.type = officeType;
    const snapshot = await readDataValidation(h.context, h.target, () => true);
    expect(snapshot.type).toBe(type);
    expect(snapshot.operator).toBeNull();
    expect(snapshot.ignore_blank).toBeNull();
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it("rejects validation inspection on hosts below ExcelApi 1.8", async () => {
    const h = harness();
    await expect(
      readDataValidation(h.context, h.target, () => false),
    ).rejects.toThrow("requires ExcelApi 1.8");
    expect(h.dataValidation.load).not.toHaveBeenCalled();
    expect(h.context.sync).not.toHaveBeenCalled();
  });

  it("clears the complete validation", async () => {
    const h = harness();
    const deleteValidation = createDeleteDataValidation(h.getRange, () => true);

    await deleteValidation(h.context, { args: [] });

    expect(h.dataValidation.clear).toHaveBeenCalledOnce();
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it("rejects hosts below ExcelApi 1.8 before resolving the range", async () => {
    const h = harness();
    const setList = createSetDataValidationList(
      h.getRange,
      h.getSheet,
      () => false,
    );

    await expect(
      setList(h.context, {
        args: [{ type: "literal", values: ["Open"] }, true],
      }),
    ).rejects.toThrow("ExcelApi 1.8");
    expect(h.getRange).not.toHaveBeenCalled();
    expect(h.context.sync).not.toHaveBeenCalled();
  });

  it.each([
    [null, true, "must be an object"],
    [{ type: "literal", values: [] }, true, "non-empty array"],
    [{ type: "literal", values: ["Open,Closed"] }, true, "without separators"],
    [{ type: "range", sheet_position: 0 }, true, "coordinates"],
    [{ type: "name", name: "" }, true, "require a name"],
    [{ type: "unknown" }, true, "Unknown data validation"],
    [{ type: "literal", values: ["Open"] }, 1, "must be a boolean"],
  ])(
    "rejects an invalid source before touching the target",
    async (source, dropdown, message) => {
      const h = harness();
      const setList = createSetDataValidationList(
        h.getRange,
        h.getSheet,
        () => true,
      );

      await expect(
        setList(h.context, { args: [source, dropdown] }),
      ).rejects.toThrow(message);
      expect(h.getRange).not.toHaveBeenCalled();
      expect(h.context.sync).not.toHaveBeenCalled();
    },
  );

  it("propagates protected-sheet failures from the Office request", async () => {
    const h = harness();
    const protectedError = new Error("The worksheet is protected");
    h.context.sync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(protectedError);
    const setList = createSetDataValidationList(
      h.getRange,
      h.getSheet,
      () => true,
    );

    await expect(
      setList(h.context, {
        args: [{ type: "literal", values: ["Open"] }, true],
      }),
    ).rejects.toBe(protectedError);
  });

  it("propagates a missing target range without synchronizing", async () => {
    const h = harness();
    const missingError = new Error("The target range no longer exists");
    h.getRange.mockRejectedValueOnce(missingError);
    const setList = createSetDataValidationList(
      h.getRange,
      h.getSheet,
      () => true,
    );

    await expect(
      setList(h.context, {
        args: [{ type: "literal", values: ["Open"] }, true],
      }),
    ).rejects.toBe(missingError);
    expect(h.context.sync).not.toHaveBeenCalled();
  });
});

describe("setBorderProperty action callback", () => {
  // The Python side (xlwings.pro._xlremote.Border) sends one action per side
  // and attribute: args = [side, attribute, value], all in its snake_case
  // vocabulary, with a null line_style meaning "remove the border".
  function harness() {
    const writes = [];
    const getItem = vi.fn((sideIndex) => {
      const border = {};
      for (const property of ["style", "weight", "color"]) {
        Object.defineProperty(border, property, {
          set(value) {
            writes.push([sideIndex, property, value]);
          },
        });
      }
      return border;
    });
    const range = { format: { borders: { getItem } } };
    return {
      writes,
      getItem,
      getRange: vi.fn(async () => range),
      context: { sync: vi.fn(async () => {}) },
    };
  }

  it.each([
    ["edge_top", "EdgeTop"],
    ["edge_bottom", "EdgeBottom"],
    ["edge_left", "EdgeLeft"],
    ["edge_right", "EdgeRight"],
    ["inside_vertical", "InsideVertical"],
    ["inside_horizontal", "InsideHorizontal"],
    ["diagonal_down", "DiagonalDown"],
    ["diagonal_up", "DiagonalUp"],
  ])("maps the side %s onto BorderIndex %s", async (side, sideIndex) => {
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);

    await setBorderProperty(h.context, { args: [side, "weight", "thin"] });

    expect(h.getItem).toHaveBeenCalledWith(sideIndex);
    expect(h.writes).toEqual([[sideIndex, "weight", "Thin"]]);
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it.each([
    ["continuous", "Continuous"],
    ["dash", "Dash"],
    ["dash_dot", "DashDot"],
    ["dash_dot_dot", "DashDotDot"],
    ["dot", "Dot"],
    ["double", "Double"],
    ["slant_dash_dot", "SlantDashDot"],
    ["none", "None"],
  ])("maps the line style %s onto %s", async (lineStyle, officeStyle) => {
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);

    await setBorderProperty(h.context, {
      args: ["edge_top", "line_style", lineStyle],
    });

    expect(h.writes).toEqual([["EdgeTop", "style", officeStyle]]);
  });

  it.each([
    ["null", null],
    // Lite's Pyodide bridge turns Python's None into undefined, not null
    ["undefined", undefined],
  ])("removes the border for a %s line style", async (_, value) => {
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);

    await setBorderProperty(h.context, {
      args: ["inside_horizontal", "line_style", value],
    });

    expect(h.writes).toEqual([["InsideHorizontal", "style", "None"]]);
  });

  it.each([
    ["hairline", "Hairline"],
    ["thin", "Thin"],
    ["medium", "Medium"],
    ["thick", "Thick"],
  ])("maps the weight %s onto %s", async (weight, officeWeight) => {
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);

    await setBorderProperty(h.context, {
      args: ["edge_left", "weight", weight],
    });

    expect(h.writes).toEqual([["EdgeLeft", "weight", officeWeight]]);
  });

  it("writes the hex color through unchanged", async () => {
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);

    await setBorderProperty(h.context, {
      args: ["edge_right", "color", "#ff0000"],
    });

    expect(h.writes).toEqual([["EdgeRight", "color", "#ff0000"]]);
  });

  it.each([
    [["outside", "weight", "thin"], "Unknown border side: outside"],
    [["EdgeTop", "weight", "thin"], "Unknown border side: EdgeTop"],
    [["edge_top", "style", "dash"], "Unknown border attribute: style"],
    [["edge_top", "line_style", "dashed"], "Unknown border line style: dashed"],
    [["edge_top", "line_style", "Dash"], "Unknown border line style: Dash"],
    [["edge_top", "weight", "bold"], "Unknown border weight: bold"],
    [["edge_top", "weight", null], "Unknown border weight: null"],
    [["edge_top", "color", null], "Border color must be #RRGGBB, not null"],
    [["edge_top", "color", "red"], "Border color must be #RRGGBB, not red"],
  ])("rejects %j before touching the range", async (args, message) => {
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);

    await expect(setBorderProperty(h.context, { args })).rejects.toThrow(
      message,
    );
    expect(h.getRange).not.toHaveBeenCalled();
    expect(h.context.sync).not.toHaveBeenCalled();
  });

  it("applies a combined write in the order the actions arrive", async () => {
    // Borders.set() queues color, weight, line style per side, in that order
    // (see xlwings.main.Borders.set), and relies on the client keeping it.
    const h = harness();
    const setBorderProperty = createSetBorderProperty(h.getRange);
    const actions = [];
    for (const side of ["edge_top", "edge_bottom"]) {
      actions.push(
        { func: "setBorderProperty", args: [side, "color", "#ff0000"] },
        { func: "setBorderProperty", args: [side, "weight", "thick"] },
        { func: "setBorderProperty", args: [side, "line_style", null] },
      );
    }

    await dispatchActions(actions, h.context, { setBorderProperty });

    expect(h.writes).toEqual([
      ["EdgeTop", "color", "#ff0000"],
      ["EdgeTop", "weight", "Thick"],
      ["EdgeTop", "style", "None"],
      ["EdgeBottom", "color", "#ff0000"],
      ["EdgeBottom", "weight", "Thick"],
      ["EdgeBottom", "style", "None"],
    ]);
    expect(h.context.sync).toHaveBeenCalledTimes(6);
  });
});
