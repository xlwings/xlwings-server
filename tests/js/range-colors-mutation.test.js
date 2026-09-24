import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSetRangeColors } from "../../xlwings_server/static/js/custom-scripts/range-colors.js";

const action = (overrides = {}) => ({
  row_count: 2,
  column_count: 3,
  args: [
    [
      ["#008000", "keep", null],
      ["#FFFFFF", "#ff0000", "keep"],
    ],
  ],
  ...overrides,
});

function harness() {
  const range = { setCellProperties: vi.fn() };
  const getRange = vi.fn(async () => range);
  const context = { sync: vi.fn(async () => {}) };
  return { range, getRange, context, callback: createSetRangeColors(getRange) };
}

beforeEach(() => {
  vi.stubGlobal("Office", {
    context: { requirements: { isSetSupported: vi.fn(() => true) } },
  });
});

describe("bulk direct-fill mutation", () => {
  it("sends set, unchanged and clear states in one Office call", async () => {
    const { range, getRange, context, callback } = harness();
    await callback(context, action());
    expect(Office.context.requirements.isSetSupported).toHaveBeenCalledWith(
      "ExcelApi",
      "1.9",
    );
    expect(getRange).toHaveBeenCalledOnce();
    expect(range.setCellProperties).toHaveBeenCalledExactlyOnceWith([
      [
        { format: { fill: { color: "#008000" } } },
        {},
        { format: { fill: { pattern: "None" } } },
      ],
      [
        { format: { fill: { color: "#FFFFFF" } } },
        { format: { fill: { color: "#ff0000" } } },
        {},
      ],
    ]);
    expect(context.sync).toHaveBeenCalledOnce();
  });

  it.each([
    ["wrong row count", action({ row_count: 1 })],
    ["ragged matrix", action({ args: [[["#FFFFFF"]]] })],
    [
      "invalid color",
      action({
        args: [
          [
            ["red", "keep", null],
            ["#FFFFFF", "#ff0000", "keep"],
          ],
        ],
      }),
    ],
    ["invalid dimensions", action({ row_count: 0 })],
    [
      "invalid last cell",
      action({
        args: [
          [
            ["#008000", "keep", null],
            ["#FFFFFF", "#ff0000", "red"],
          ],
        ],
      }),
    ],
  ])("rejects %s before touching Excel", async (_name, payload) => {
    const { getRange, context, callback } = harness();
    await expect(callback(context, payload)).rejects.toMatchObject({
      code: "invalid_colors",
    });
    expect(getRange).not.toHaveBeenCalled();
    expect(context.sync).not.toHaveBeenCalled();
  });

  it("rejects an oversized action before touching Excel", async () => {
    const { getRange, context, callback } = harness();
    await expect(
      callback(context, action({ row_count: 10_001, column_count: 1 })),
    ).rejects.toMatchObject({ code: "range_too_large" });
    expect(getRange).not.toHaveBeenCalled();
  });

  it("rejects hosts without ExcelApi 1.9", async () => {
    Office.context.requirements.isSetSupported.mockReturnValue(false);
    const { getRange, context, callback } = harness();
    await expect(callback(context, action())).rejects.toMatchObject({
      code: "unsupported_host",
    });
    expect(getRange).not.toHaveBeenCalled();
  });

  it("propagates a protected-sheet host failure", async () => {
    const { context, callback } = harness();
    const protectedError = Object.assign(new Error("Sheet is protected"), {
      code: "AccessDenied",
    });
    context.sync.mockRejectedValueOnce(protectedError);
    await expect(callback(context, action())).rejects.toBe(protectedError);
  });
});
