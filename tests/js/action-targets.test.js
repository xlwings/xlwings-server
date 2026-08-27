import { describe, expect, it, vi } from "vitest";

import { getActionSheet } from "../../xlwings_server/static/js/custom-scripts/action-targets.js";

describe("getActionSheet", () => {
  it("resolves the target sheet by position", async () => {
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
