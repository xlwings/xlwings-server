import { describe, expect, it, vi } from "vitest";

import {
  createAddConditionalFormat,
  createClearConditionalFormats,
  createDeleteConditionalFormat,
  createSetConditionalFormat,
} from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";
import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";

function supported(name, version) {
  return name === "ExcelApi" && version === "1.6";
}

function format(fillColor = null, font = {}) {
  return {
    fill: { color: fillColor, load: vi.fn() },
    font: {
      color: font.color ?? null,
      bold: font.bold ?? null,
      italic: font.italic ?? null,
      load: vi.fn(),
    },
  };
}

describe("addConditionalFormat action callback", () => {
  function harness(type) {
    const rule = {
      type,
      stopIfTrue: false,
      cellValue: { rule: {}, format: format() },
      custom: {
        rule: { formula: "", load: vi.fn() },
        format: format(),
      },
    };
    const add = vi.fn(() => rule);
    return {
      rule,
      add,
      getRange: vi.fn(async () => ({ conditionalFormats: { add } })),
      context: { sync: vi.fn(async () => {}) },
    };
  }

  it("adds a complete cell-value rule in one synchronization", async () => {
    const h = harness("CellValue");
    const spec = {
      type: "CellValue",
      operator: "LessThan",
      formula1: "60",
      formula2: null,
      fill_color: "#ffff00",
      font_italic: true,
      stop_if_true: true,
    };

    await createAddConditionalFormat(h.getRange, supported)(h.context, {
      args: [spec],
    });

    expect(h.add).toHaveBeenCalledWith("CellValue");
    expect(h.rule.cellValue.rule).toEqual({
      operator: "LessThan",
      formula1: "60",
    });
    expect(h.rule.cellValue.format.fill.color).toBe("#ffff00");
    expect(h.rule.cellValue.format.font.italic).toBe(true);
    expect(h.rule.stopIfTrue).toBe(true);
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it("adds a custom-formula rule", async () => {
    const h = harness("Custom");
    await createAddConditionalFormat(h.getRange, supported)(h.context, {
      args: [
        {
          type: "Custom",
          formula: "=$A2<>$B2",
          font_bold: true,
          stop_if_true: false,
        },
      ],
    });
    expect(h.add).toHaveBeenCalledWith("Custom");
    expect(h.rule.custom.rule.formula).toBe("=$A2<>$B2");
    expect(h.rule.custom.format.font.bold).toBe(true);
  });

  it.each([
    [
      "CellValue",
      {
        type: "CellValue",
        operator: "LessThan",
        formula1: "60",
      },
      { operator: "LessThan", formula1: "60" },
    ],
    [
      "Custom",
      { type: "Custom", formula: "=$A2<>$B2" },
      { formula: "=$A2<>$B2" },
    ],
  ])(
    "does not read an unloaded %s rule before assigning it",
    async (type, spec, expected) => {
      let assigned;
      const detail = { format: format() };
      Object.defineProperty(detail, "rule", {
        get() {
          throw new Error("The property 'rule' is not available");
        },
        set(value) {
          assigned = value;
        },
      });
      const rule = {
        stopIfTrue: false,
        [type === "CellValue" ? "cellValue" : "custom"]: detail,
      };
      const getRange = vi.fn(async () => ({
        conditionalFormats: { add: vi.fn(() => rule) },
      }));

      await createAddConditionalFormat(getRange, supported)(
        { sync: vi.fn(async () => {}) },
        { args: [spec] },
      );

      expect(assigned).toEqual(expected);
    },
  );

  it("rejects malformed input before touching Excel", async () => {
    const h = harness("CellValue");
    await expect(
      createAddConditionalFormat(h.getRange, supported)(h.context, {
        args: [{ type: "CellValue", operator: "Nope", formula1: "60" }],
      }),
    ).rejects.toThrow("Invalid conditional-format operator");
    expect(h.getRange).not.toHaveBeenCalled();
  });

  it("adds a color scale with explicit number thresholds", async () => {
    const rule = { colorScale: { criteria: null } };
    const add = vi.fn(() => rule);
    const getRange = vi.fn(async () => ({ conditionalFormats: { add } }));
    const context = { sync: vi.fn(async () => {}) };

    await createAddConditionalFormat(getRange, supported)(context, {
      args: [
        {
          type: "ColorScale",
          colors: ["#f8696b", "#ffeb84", "#63be7b"],
          threshold_types: ["Number", "Number", "Number"],
          thresholds: [0, 50, 100],
        },
      ],
    });

    expect(add).toHaveBeenCalledWith("ColorScale");
    expect(rule.colorScale.criteria).toEqual({
      minimum: { color: "#f8696b", type: "Number", formula: "0" },
      midpoint: { color: "#ffeb84", type: "Number", formula: "50" },
      maximum: { color: "#63be7b", type: "Number", formula: "100" },
    });
  });

  it("adds a data bar with an automatic lower bound", async () => {
    const rule = {
      dataBar: {
        lowerBoundRule: null,
        upperBoundRule: null,
        positiveFormat: {},
        showDataBarOnly: false,
      },
    };
    const add = vi.fn(() => rule);
    const getRange = vi.fn(async () => ({ conditionalFormats: { add } }));
    const context = { sync: vi.fn(async () => {}) };

    await createAddConditionalFormat(getRange, supported)(context, {
      args: [
        {
          type: "DataBar",
          bar_color: "#638ec6",
          gradient: false,
          show_value: false,
          threshold_types: ["Automatic", "Number"],
          thresholds: [null, 100],
        },
      ],
    });

    expect(rule.dataBar.lowerBoundRule).toEqual({ type: "Automatic" });
    expect(rule.dataBar.upperBoundRule).toEqual({
      type: "Number",
      formula: "100",
    });
    expect(rule.dataBar.positiveFormat).toEqual({
      fillColor: "#638ec6",
      gradientFill: false,
    });
    expect(rule.dataBar.showDataBarOnly).toBe(true);
  });

  it("adds an icon set with fixed thresholds", async () => {
    const rule = { iconSet: {} };
    const add = vi.fn(() => rule);
    const getRange = vi.fn(async () => ({ conditionalFormats: { add } }));
    const context = { sync: vi.fn(async () => {}) };

    await createAddConditionalFormat(getRange, supported)(context, {
      args: [
        {
          type: "IconSet",
          icon_set: "ThreeTrafficLights1",
          show_value: false,
          reverse_order: true,
          threshold_types: ["Number", "Number"],
          thresholds: [60, 80],
        },
      ],
    });

    expect(rule.iconSet.style).toBe("ThreeTrafficLights1");
    expect(rule.iconSet.showIconOnly).toBe(true);
    expect(rule.iconSet.reverseIconOrder).toBe(true);
    expect(rule.iconSet.criteria.slice(1)).toEqual([
      { type: "Number", operator: "GreaterThanOrEqual", formula: "60" },
      { type: "Number", operator: "GreaterThanOrEqual", formula: "80" },
    ]);
  });

  it("rejects malformed visual rules before touching Excel", async () => {
    const getRange = vi.fn();
    await expect(
      createAddConditionalFormat(getRange, supported)(
        { sync: vi.fn() },
        {
          args: [
            {
              type: "IconSet",
              icon_set: "ThreeArrows",
              show_value: true,
              reverse_order: false,
              threshold_types: ["Number"],
              thresholds: [50],
            },
          ],
        },
      ),
    ).rejects.toThrow("thresholds must contain 2");
    await expect(
      createAddConditionalFormat(getRange, supported)(
        { sync: vi.fn() },
        {
          args: [
            {
              type: "DataBar",
              bar_color: "#638ec6",
              gradient: true,
              show_value: true,
              threshold_types: ["Automatic", "Automatic"],
              thresholds: [null, null],
              font_bold: true,
            },
          ],
        },
      ),
    ).rejects.toThrow("font_bold is not valid for DataBar rules");
    expect(getRange).not.toHaveBeenCalled();
  });
});

describe("setConditionalFormat action callback", () => {
  function harness() {
    const rule = {
      type: "CellValue",
      stopIfTrue: false,
      load: vi.fn(),
      cellValue: {
        rule: { operator: "LessThan", formula1: "60" },
        load: vi.fn(),
        format: format("#ffff00", { italic: true }),
      },
    };
    const getItemAt = vi.fn(() => rule);
    return {
      rule,
      getItemAt,
      getRange: vi.fn(async () => ({
        conditionalFormats: { getItemAt },
      })),
      context: { sync: vi.fn(async () => {}) },
    };
  }

  const expected = {
    type: "CellValue",
    stop_if_true: false,
    operator: "LessThan",
    formula1: "60",
    formula2: null,
    fill_color: "#ffff00",
    font_color: null,
    font_bold: null,
    font_italic: true,
  };

  it("validates the snapshot and changes only supplied fields", async () => {
    const h = harness();
    await createSetConditionalFormat(h.getRange, supported)(h.context, {
      args: [0, expected, { formula1: "70", font_italic: false }],
    });

    expect(h.getItemAt).toHaveBeenCalledWith(0);
    expect(h.rule.cellValue.rule).toEqual({
      operator: "LessThan",
      formula1: "70",
    });
    expect(h.rule.cellValue.format.fill.color).toBe("#ffff00");
    expect(h.rule.cellValue.format.font.italic).toBe(false);
    expect(h.context.sync).toHaveBeenCalledTimes(3);
  });

  it("refuses a stale rule before applying changes", async () => {
    const h = harness();
    h.rule.cellValue.rule.formula1 = "61";
    await expect(
      createSetConditionalFormat(h.getRange, supported)(h.context, {
        args: [0, expected, { formula1: "70" }],
      }),
    ).rejects.toThrow("changed since it was read");
    expect(h.rule.cellValue.rule.formula1).toBe("61");
    expect(h.context.sync).toHaveBeenCalledTimes(2);
  });

  it("updates a custom formula without disturbing its font", async () => {
    const rule = {
      type: "Custom",
      stopIfTrue: true,
      load: vi.fn(),
      custom: {
        rule: { formula: "=$A2<>$B2", load: vi.fn() },
        format: format("#fff2cc", { bold: true }),
      },
    };
    const getRange = vi.fn(async () => ({
      conditionalFormats: { getItemAt: vi.fn(() => rule) },
    }));
    const context = { sync: vi.fn(async () => {}) };
    await createSetConditionalFormat(getRange, supported)(context, {
      args: [
        0,
        {
          type: "Custom",
          stop_if_true: true,
          formula: "=$A2<>$B2",
        },
        { formula: "=$A2=$B2", fill_color: "#ffc7ce" },
      ],
    });

    expect(rule.custom.rule.formula).toBe("=$A2=$B2");
    expect(rule.custom.format.fill.color).toBe("#ffc7ce");
    expect(rule.custom.format.font.bold).toBe(true);
  });
});

describe("clearConditionalFormats action callback", () => {
  it("clears the rules active on the target range and synchronizes", async () => {
    const clearAll = vi.fn();
    const range = { conditionalFormats: { clearAll } };
    const getRange = vi.fn(async () => range);
    const context = { sync: vi.fn(async () => {}) };

    await createClearConditionalFormats(getRange, supported)(context, {});

    expect(clearAll).toHaveBeenCalledOnce();
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it("rejects unsupported hosts before touching the range", async () => {
    const getRange = vi.fn();
    await expect(
      createClearConditionalFormats(getRange, () => false)(
        { sync: vi.fn() },
        {},
      ),
    ).rejects.toThrow("ExcelApi 1.6");
    expect(getRange).not.toHaveBeenCalled();
  });
});

describe("deleteConditionalFormat action callback", () => {
  function harness({ type = "CellValue", stopIfTrue = true } = {}) {
    const rule = {
      type,
      stopIfTrue,
      load: vi.fn(),
      delete: vi.fn(),
    };
    const getItemAt = vi.fn(() => rule);
    const range = { conditionalFormats: { getItemAt } };
    return {
      rule,
      getItemAt,
      getRange: vi.fn(async () => range),
      context: { sync: vi.fn(async () => {}) },
    };
  }

  it("validates the snapshot before deleting the selected rule", async () => {
    const h = harness();
    const callback = createDeleteConditionalFormat(h.getRange, supported);

    await callback(h.context, { args: [2, "CellValue", true] });

    expect(h.getItemAt).toHaveBeenCalledWith(2);
    expect(h.rule.load).toHaveBeenCalledWith("type,stopIfTrue");
    expect(h.context.sync).toHaveBeenCalledTimes(2);
    expect(h.rule.delete).toHaveBeenCalledOnce();
  });

  it("accepts null stop-if-true for rule families without that setting", async () => {
    const h = harness({ type: "DataBar", stopIfTrue: null });
    await createDeleteConditionalFormat(h.getRange, supported)(h.context, {
      args: [0, "DataBar", undefined],
    });
    expect(h.rule.delete).toHaveBeenCalledOnce();
  });

  it("refuses a stale position instead of deleting a neighboring rule", async () => {
    const h = harness({ type: "Custom", stopIfTrue: false });
    await expect(
      createDeleteConditionalFormat(h.getRange, supported)(h.context, {
        args: [0, "CellValue", false],
      }),
    ).rejects.toThrow("changed since it was read");
    expect(h.rule.delete).not.toHaveBeenCalled();
    expect(h.context.sync).toHaveBeenCalledOnce();
  });

  it("surfaces a missing rule without attempting a deletion", async () => {
    const h = harness();
    h.context.sync.mockRejectedValueOnce(
      new Error(
        "The argument is invalid or missing or has an incorrect format",
      ),
    );

    await expect(
      createDeleteConditionalFormat(h.getRange, supported)(h.context, {
        args: [4, "CellValue", true],
      }),
    ).rejects.toThrow("invalid or missing");
    expect(h.getItemAt).toHaveBeenCalledWith(4);
    expect(h.rule.delete).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, "0", null])(
    "rejects invalid position %j before touching Excel",
    async (position) => {
      const h = harness();
      await expect(
        createDeleteConditionalFormat(h.getRange, supported)(h.context, {
          args: [position, "CellValue", true],
        }),
      ).rejects.toThrow("Invalid conditional-format position");
      expect(h.getRange).not.toHaveBeenCalled();
    },
  );

  it("surfaces a protected-sheet failure with dispatch context", async () => {
    const h = harness();
    h.context.sync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("The worksheet is protected"));

    await expect(
      dispatchActions(
        [{ func: "deleteConditionalFormat", args: [0, "CellValue", true] }],
        h.context,
        {
          deleteConditionalFormat: createDeleteConditionalFormat(
            h.getRange,
            supported,
          ),
        },
      ),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      appliedActionCount: 1,
      actionFunc: "deleteConditionalFormat",
    });
  });
});
