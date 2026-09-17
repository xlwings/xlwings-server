import { describe, expect, it, vi } from "vitest";

import {
  createClearConditionalFormats,
  createDeleteConditionalFormat,
} from "../../xlwings_server/static/js/custom-scripts/range-action-callbacks.js";
import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";

function supported(name, version) {
  return name === "ExcelApi" && version === "1.6";
}

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
