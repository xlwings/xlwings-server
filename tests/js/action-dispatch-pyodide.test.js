// Optional real-Pyodide regression: install pyodide without saving it, or set
// XLWINGS_PYODIDE_MODULE=/path/to/pyodide.mjs when running npm test.
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { dispatchActions } from "../../xlwings_server/static/js/custom-scripts/action-dispatch.js";
import { createAddTableRow } from "../../xlwings_server/static/js/custom-scripts/table-action-callbacks.js";
import { createClearAutoFilterRange } from "../../xlwings_server/static/js/custom-scripts/autofilter-action-callbacks.js";

const require = createRequire(import.meta.url);
let modulePath = process.env.XLWINGS_PYODIDE_MODULE;
if (!modulePath) {
  try {
    modulePath = require.resolve("pyodide");
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
  }
}

describe.skipIf(!modulePath)("dispatchActions with real Pyodide", () => {
  let pyodide;
  beforeAll(async () => {
    const { loadPyodide } = await import(
      /* @vite-ignore */ pathToFileURL(modulePath).href
    );
    pyodide = await loadPyodide({ indexURL: dirname(modulePath) + "/" });
    pyodide.runPython(`
import js
from pyodide.ffi import to_js

def action_envelope():
    return to_js({"actions": [
        {"func": "addTableRow", "args": [0, 2, None]},
        {"func": "addTableRow", "args": [0, 2, ["case", None, "", 0, False]]},
        {"func": "clearAutoFilterRange", "args": [None], "column_count": 5},
    ]}, dict_converter=js.Object.fromEntries)
`);
  }, 30_000);

  it("normalizes converted None values before table and autofilter callbacks", async () => {
    const added = [];
    const cleared = [];
    const context = { sync: async () => {} };
    const rows = {
      count: 2,
      load() {
        return this;
      },
      add(index, values) {
        added.push([index, values]);
      },
    };
    const table = {
      rows,
      getRange: () => ({
        columnCount: 5,
        load() {
          return this;
        },
      }),
    };
    const range = {
      address: "Sheet1!A1:E3",
      load() {
        return this;
      },
    };
    const sheet = {
      name: "Sheet1",
      load() {
        return this;
      },
      protection: {
        protected: false,
        load() {
          return this;
        },
      },
      autoFilter: {
        getRangeOrNullObject: () => ({ ...range, isNullObject: false }),
        clearColumnCriteria: (index) => cleared.push(index),
      },
    };
    const callbacks = {
      addTableRow: createAddTableRow(
        async () => sheet,
        async () => table,
        () => true,
      ),
      clearAutoFilterRange: createClearAutoFilterRange(
        async () => range,
        async () => sheet,
        () => true,
      ),
    };
    const envelope = pyodide.runPython("action_envelope()");
    // Verify the actual conversion produced undefined, not JSON null fixtures.
    expect(envelope.actions[0].args[2]).toBeUndefined();
    expect(envelope.actions[1].args[2][1]).toBeUndefined();
    expect(envelope.actions[2].args[0]).toBeUndefined();
    await dispatchActions(envelope.actions, context, callbacks);
    expect(added).toStrictEqual([
      [2, undefined],
      [2, [["case", null, "", 0, false]]],
    ]);
    expect(cleared).toStrictEqual([0, 1, 2, 3, 4]);
  });
});
