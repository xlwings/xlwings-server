import { describe, expect, it, vi } from "vitest";

import { getActionSheet } from "../../xlwings_server/static/js/custom-scripts/action-targets.js";

describe("getActionSheet", () => {
  it("prefers the Wingman sheet name over a potentially stale position", async () => {
    const named = { name: "Target" };
    const worksheets = {
      getItem: vi.fn(() => named),
      load: vi.fn(),
    };
    const context = {
      workbook: { worksheets },
      sync: vi.fn(async () => {}),
    };

    await expect(
      getActionSheet(context, { sheet_name: "Target", sheet_position: 7 }),
    ).resolves.toBe(named);
    expect(worksheets.getItem).toHaveBeenCalledWith("Target");
    expect(worksheets.load).not.toHaveBeenCalled();
    expect(context.sync).not.toHaveBeenCalled();
  });

  it("retains position addressing for existing Python-generated actions", async () => {
    const positioned = { name: "Legacy" };
    const loaded = { items: [{}, positioned] };
    const worksheets = {
      getItem: vi.fn(),
      load: vi.fn(() => loaded),
    };
    const context = {
      workbook: { worksheets },
      sync: vi.fn(async () => {}),
    };

    await expect(getActionSheet(context, { sheet_position: 1 })).resolves.toBe(
      positioned,
    );
    expect(worksheets.load).toHaveBeenCalledWith("items");
    expect(context.sync).toHaveBeenCalledOnce();
    expect(worksheets.getItem).not.toHaveBeenCalled();
  });
});
