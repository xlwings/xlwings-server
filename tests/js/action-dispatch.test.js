import { describe, expect, it, vi } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";

describe("dispatchActions", () => {
  it("dispatches actions in order and preserves sheet sync behavior", async () => {
    const seen = [];
    const context = { sync: vi.fn(async () => seen.push("sync")) };
    const callbacks = {
      setValues: vi.fn(async () => seen.push("values")),
      addSheet: vi.fn(async () => seen.push("sheet")),
    };

    await dispatchActions(
      [{ func: "setValues" }, { func: "addSheet" }],
      context,
      callbacks,
    );

    expect(seen).toEqual(["values", "sheet", "sync"]);
  });

  it("reports an unknown action with its batch position", async () => {
    await expect(
      dispatchActions([{ func: "missing" }], { sync: vi.fn() }, {}),
    ).rejects.toMatchObject({
      code: "unknown_action",
      actionIndex: 0,
      appliedActionCount: 0,
      actionFunc: "missing",
    });
  });

  it("wraps callback failures with their batch position", async () => {
    await expect(
      dispatchActions(
        [{ func: "setValues" }],
        { sync: vi.fn() },
        {
          setValues: async () => Promise.reject(new Error("Excel rejected it")),
        },
      ),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 0,
      appliedActionCount: 1,
      actionFunc: "setValues",
    });
  });

  it("makes partial execution explicit when a later action fails", async () => {
    await expect(
      dispatchActions(
        [{ func: "setValues" }, { func: "addSheet" }],
        { sync: vi.fn(async () => {}) },
        {
          setValues: async () => {},
          addSheet: async () => Promise.reject(new Error("protected")),
        },
      ),
    ).rejects.toMatchObject({
      code: "action_failed",
      actionIndex: 1,
      appliedActionCount: 2,
      message: expect.stringContaining(
        "Up to 2 actions may already have been applied, including the failing action",
      ),
    });
  });
});
