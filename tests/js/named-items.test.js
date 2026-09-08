import { describe, expect, it, vi } from "vitest";
import { readNamedItems } from "../../xlwings_server/static/js/custom-scripts/named-items.js";

function loadable(properties) {
  const object = { ...properties };
  object.load = vi.fn(() => object);
  return object;
}

describe("named item snapshots", () => {
  it.each([false, true])(
    "preserves all definitions (sheet scope: %s)",
    async (sheetScope) => {
      const scopeSheet = sheetScope
        ? loadable({ name: "Scope", position: 2 })
        : null;
      const range = loadable({
        isNullObject: false,
        address: "'Data!Sheet'!$A$1:$B$2",
        worksheet: loadable({ position: 1 }),
      });
      const items = [
        {
          name: "Cells",
          type: "Range",
          formula: "='Data!Sheet'!$A$1:$B$2",
          getRangeOrNullObject: vi.fn(() => range),
        },
        {
          name: "DOUBLE_VALUE",
          type: "Error",
          formula: "=LAMBDA(value,value*2)",
        },
        { name: "Constant", type: "Integer", formula: "=42" },
        { name: "Text", type: "String", formula: '="hello!"' },
        { name: "Broken", type: "Error", formula: "=#REF!" },
        {
          name: "Areas",
          type: "Range",
          formula: "=(Data!$A$1,Data!$C$3)",
          getRangeOrNullObject: vi.fn(() => ({ isNullObject: true })),
        },
      ];
      for (const item of items) {
        item.getRangeOrNullObject ||= vi.fn(() => {
          throw new Error("not a range");
        });
      }
      const collection = loadable({ items });
      const context = { sync: vi.fn(async () => {}) };
      const result = await readNamedItems(context, [
        { collection, scopeSheet },
      ]);

      expect(collection.load).toHaveBeenCalledWith("name, type, formula");
      expect(result).toHaveLength(items.length);
      expect(result.map((entry) => entry.refers_to)).toEqual(
        items.map((item) => item.formula),
      );
      expect(result[0]).toEqual({
        name: "Cells",
        type: "Range",
        refers_to: items[0].formula,
        sheet_index: 1,
        address: "$A$1:$B$2",
        book_scope: !sheetScope,
        scope_sheet_name: sheetScope ? "Scope" : null,
        scope_sheet_index: sheetScope ? 2 : null,
      });
      for (const entry of result.slice(1)) {
        expect(entry).toMatchObject({
          sheet_index: null,
          address: null,
          book_scope: !sheetScope,
        });
      }
      for (const item of items.slice(1, 5)) {
        expect(item.getRangeOrNullObject).not.toHaveBeenCalled();
      }
    },
  );

  it("batches workbook and worksheet names without syncing per sheet", async () => {
    const context = { sync: vi.fn(async () => {}) };
    const scopes = Array.from({ length: 20 }, (_, index) => ({
      collection: loadable({
        items: [{ name: "Demo", formula: "=42", type: "Integer" }],
      }),
      scopeSheet: index
        ? loadable({ name: `Sheet${index}`, position: index - 1 })
        : null,
    }));
    const result = await readNamedItems(context, scopes);
    expect(result).toHaveLength(20);
    expect(result[0].book_scope).toBe(true);
    expect(result[1].scope_sheet_name).toBe("Sheet1");
    expect(context.sync).toHaveBeenCalledTimes(3);
  });

  it("propagates Office errors instead of silently dropping definitions", async () => {
    await expect(
      readNamedItems(
        { sync: vi.fn().mockRejectedValue(new Error("Excel disconnected")) },
        [{ collection: loadable({ items: [] }) }],
      ),
    ).rejects.toThrow("Excel disconnected");
  });
});
