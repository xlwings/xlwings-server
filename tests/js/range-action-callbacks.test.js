import { describe, expect, it, vi } from "vitest";

import {
  createSetBorderProperty,
  createSetColumnWidth,
  createSetFormula,
  createSetFormulaArray,
} from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";
import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";

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
