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

  it("rejects malformed input before touching Excel", async () => {
    const h = harness("CellValue");
    await expect(
      createAddConditionalFormat(h.getRange, supported)(h.context, {
        args: [{ type: "CellValue", operator: "Nope", formula1: "60" }],
      }),
    ).rejects.toThrow("Invalid conditional-format operator");
    expect(h.getRange).not.toHaveBeenCalled();
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
