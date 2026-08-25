import { describe, expect, it, vi } from "vitest";

import { createAddTable } from "../../xlwings_server/static/js/custom-scripts/table-action-callbacks.js";

describe("addTable action callback", () => {
  it("uses the shared sheet resolver and applies optional table metadata", async () => {
    const table = {};
    const sheet = {
      tables: {
        add: vi.fn(() => table),
      },
    };
    const getSheet = vi.fn(async () => sheet);
    const addTable = createAddTable(getSheet);
    const context = {};
    const action = {
      sheet_name: "Results",
      sheet_position: 7,
      args: ["A1:E5", true, "TableStyleMedium2", "RandomData"],
    };

    await addTable(context, action);

    expect(getSheet).toHaveBeenCalledWith(context, action);
    expect(sheet.tables.add).toHaveBeenCalledWith("A1:E5", true);
    expect(table).toEqual({
      style: "TableStyleMedium2",
      name: "RandomData",
    });
  });

  it("preserves generated defaults when style and name are omitted", async () => {
    const table = {};
    const sheet = { tables: { add: vi.fn(() => table) } };
    const addTable = createAddTable(async () => sheet);

    await addTable({}, { args: ["A1:B2", false, null, null] });

    expect(sheet.tables.add).toHaveBeenCalledWith("A1:B2", false);
    expect(table).toEqual({});
  });
});
