// Loads the real custom-functions-code.js and exposes its internals for testing.
//
// That file is served from a dynamic route (see routers/xlwings.py), not as a static
// module: it's a classic script with no exports that reads its dependencies off
// globalThis. So instead of importing it, we read it from disk and evaluate it in a
// function scope with stubbed Office/Excel globals, then hand back the internals we want
// to assert on. This keeps the tests pointed at the shipped code rather than a copy.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(
  here,
  "..",
  "..",
  "xlwings_server",
  "static",
  "js",
  "custom-functions",
  "custom-functions-code.js",
);

/**
 * Evaluate custom-functions-code.js against the supplied fakes.
 *
 * @param {object} opts
 * @param {boolean} opts.excelApi18  whether the host reports ExcelApi 1.8
 * @param {Function} opts.runPython  stub for globalThis.xlwings.runPython
 * @param {Function} [opts.getAuth]  stub for globalThis.getAuth
 * @param {Function} [opts.excelRun] stub for Excel.run (defaults to invoking the batch)
 */
export function loadCustomFunctionsCode({
  excelApi18 = true,
  runPython = async () => {},
  getAuth = async () => ({ token: "tok", provider: "prov" }),
  excelRun = null,
} = {}) {
  const calculatedHandlers = [];

  const Office = {
    onReady: (cb) => {
      if (cb) cb({ host: "Excel" });
      return Promise.resolve({ host: "Excel" });
    },
    context: {
      requirements: {
        isSetSupported: (name, version) => {
          if (name === "ExcelApi" && version === "1.8") return excelApi18;
          if (name === "CustomFunctionsRuntime") return true;
          return false;
        },
      },
    },
  };

  const Excel = {
    run:
      excelRun ||
      (async (batch) => {
        const context = {
          workbook: {
            worksheets: {
              onCalculated: { add: (h) => calculatedHandlers.push(h) },
            },
          },
          sync: async () => {},
        };
        return await batch(context);
      }),
    RequestContext: class {
      constructor() {
        this.workbook = { load: () => {}, name: "Book1" };
      }
      sync() {
        return Promise.resolve();
      }
    },
  };

  const sandbox = {
    Office,
    Excel,
    CustomFunctions: { associate: () => {}, Error: class {}, ErrorCode: {} },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Set,
    Map,
    Object,
    Array,
    String,
    Number,
    Math,
    Date,
    crypto: globalThis.crypto,
    localStorage: undefined,
    window: { location: { origin: "https://example.com" } },
  };

  const globals = {
    xlwings: {
      runPython,
      getCultureInfoName: async () => "en-US",
      getDateFormat: async () => "m/d/yyyy",
    },
    getAuth,
    config: {
      appPath: "",
      requestTimeout: 30,
      customFunctionsMaxRetries: 1,
      customFunctionsRetryCodes: [],
      onWasm: false,
    },
    xwRequest: { post: async () => ({ data: { result: [["ok"]] } }) },
    socket: null,
    // The Wasm (xlwings Lite) transport, read off globalThis by makeWasmCall. Tests
    // that exercise that path replace it on globalThisStub.
    wasmCustomFunctionsCall: async () => [["ok"]],
  };

  let source = readFileSync(SOURCE, "utf8");
  // Expose the internals under test. The file has no exports (see above), so we append
  // an accessor rather than restructuring the shipped code for the benefit of tests.
  source += `
  ;return {
    scheduleFlush,
    ensureCalculatedHandler,
    enqueueFollowUpScript,
    dispatchFollowUpScript,
    makeServerCall,
    makeWasmCall,
    getPending: () => pendingScripts,
    usesTimerFallback: () => useTimerFallback,
  };`;

  // In the browser these are bare references resolved off the window object (the file
  // reads them from globalThis, see its header comment), so they have to be in scope
  // here as well as on the globalThis stub. They're the same object identities, so a
  // test that mutates globalThisStub.xwRequest.post is seen by the loaded code.
  const globalThisStub = { ...globals };

  const paramNames = [
    ...Object.keys(sandbox),
    "config",
    "xwRequest",
    "xlwings",
    "globalThis",
  ];
  const paramValues = [
    ...Object.values(sandbox),
    globalThisStub.config,
    globalThisStub.xwRequest,
    globalThisStub.xlwings,
  ];

  const fn = new Function(...paramNames, `"use strict";${source}`);
  const api = fn(...paramValues, globalThisStub);

  return { ...api, calculatedHandlers, globalThisStub };
}
