// Tests for the follow-up script queue in custom-functions-code.js (xw.WithScript).
//
// This is the one piece of the feature that lives entirely in the browser: the Python
// side is covered by tests/test_router_xlwings.py and the xlwings core suite.
import { describe, expect, it, vi } from "vitest";

import { loadCustomFunctionsCode } from "./harness.js";

const SCRIPT = {
  script_name: "hello_args",
  args: ["a", 1],
  include: "",
  exclude: "",
  lazy: false,
};

// Let the microtask queue drain (the flush chain is promise-based).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("dispatchFollowUpScript", () => {
  it("forwards the script payload and auth to runPython", async () => {
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ runPython });

    await api.dispatchFollowUpScript({
      script_name: "myscript",
      args: ["x", 42],
      include: "Sheet1",
      exclude: "",
      lazy: true,
    });

    expect(runPython).toHaveBeenCalledWith({
      scriptName: "myscript",
      args: ["x", 42],
      include: "Sheet1",
      exclude: "",
      lazy: true,
      auth: "tok",
      headers: { "Auth-Provider": "prov" },
      // window.alert (the "alert" default) doesn't exist in Office.js, and there's no
      // click to attach an error to, so a failing follow-up has to reach the task pane.
      errorDisplayMode: "taskpane",
    });
  });

  it("is a no-op without a script name", async () => {
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ runPython });

    await api.dispatchFollowUpScript(null);
    await api.dispatchFollowUpScript({});

    expect(runPython).not.toHaveBeenCalled();
  });

  it("doesn't throw when the shared runtime is unavailable", async () => {
    const api = loadCustomFunctionsCode({});
    delete api.globalThisStub.xlwings.runPython;

    await expect(api.dispatchFollowUpScript(SCRIPT)).resolves.toBeUndefined();
  });
});

describe("ensureCalculatedHandler", () => {
  it("registers the workbook-wide onCalculated handler exactly once", async () => {
    const api = loadCustomFunctionsCode({ excelApi18: true });

    await Promise.all([
      api.ensureCalculatedHandler(),
      api.ensureCalculatedHandler(),
      api.ensureCalculatedHandler(),
    ]);
    await api.ensureCalculatedHandler();

    expect(api.calculatedHandlers).toHaveLength(1);
    expect(api.usesTimerFallback()).toBe(false);
  });

  it("falls back to the timer when ExcelApi 1.8 is unavailable", async () => {
    const api = loadCustomFunctionsCode({ excelApi18: false });

    await api.ensureCalculatedHandler();

    expect(api.calculatedHandlers).toHaveLength(0);
    expect(api.usesTimerFallback()).toBe(true);
  });

  it("downgrades to the timer instead of rejecting when registration fails", async () => {
    // A failed Office registration must not surface as a failed custom function: the
    // cell value is fine, only the follow-up is degraded.
    const api = loadCustomFunctionsCode({
      excelApi18: true,
      excelRun: async () => {
        throw new Error("registration blew up");
      },
    });

    await expect(api.ensureCalculatedHandler()).resolves.toBeUndefined();
    expect(api.usesTimerFallback()).toBe(true);
  });
});

describe("the flush worker", () => {
  it("dispatches queued scripts on the timer fallback", async () => {
    const seen = [];
    const api = loadCustomFunctionsCode({
      excelApi18: false,
      runPython: async ({ scriptName }) => {
        seen.push(scriptName);
      },
    });

    await api.ensureCalculatedHandler();
    api.enqueueFollowUpScript({ ...SCRIPT, script_name: "one" });
    api.enqueueFollowUpScript({ ...SCRIPT, script_name: "two" });
    await settle();

    expect(seen).toEqual(["one", "two"]);
    expect(api.getPending()).toHaveLength(0);
  });

  it("never runs two dispatches concurrently, even across overlapping flushes", async () => {
    // The case a single for...of over one drained batch would miss: a dispatched script
    // triggers another calculation, so onCalculated fires again mid-flush.
    let inFlight = 0;
    let maxInFlight = 0;
    const api = loadCustomFunctionsCode({
      excelApi18: false,
      runPython: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      },
    });

    await api.ensureCalculatedHandler();
    api
      .getPending()
      .push({ ...SCRIPT, script_name: "s0" }, { ...SCRIPT, script_name: "s1" });
    api.scheduleFlush();
    // A second flush kicks off while the first is still awaiting a dispatch, exactly as
    // onCalculated firing again mid-flush would. Without the shared chain these two
    // would interleave.
    api
      .getPending()
      .push({ ...SCRIPT, script_name: "s2" }, { ...SCRIPT, script_name: "s3" });
    api.scheduleFlush();
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(maxInFlight).toBe(1);
    expect(api.getPending()).toHaveLength(0);
  });

  it("drains scripts appended while a flush is already running", async () => {
    const seen = [];
    let api;
    api = loadCustomFunctionsCode({
      excelApi18: false,
      runPython: async ({ scriptName }) => {
        seen.push(scriptName);
        if (scriptName === "first") {
          // Simulates a script whose own recalculation queues more work.
          api.enqueueFollowUpScript({ ...SCRIPT, script_name: "second" });
        }
      },
    });

    await api.ensureCalculatedHandler();
    api.getPending().push({ ...SCRIPT, script_name: "first" });
    // Awaiting this single flush must be enough: the while loop re-checks the queue, so
    // "second" (appended while "first" was in flight) is picked up by the SAME flush.
    // A drain of one spliced batch would leave it sitting in the queue.
    await api.scheduleFlush();

    expect(seen).toEqual(["first", "second"]);
    expect(api.getPending()).toHaveLength(0);
  });

  it("keeps going after a dispatch rejects", async () => {
    // A chain-level .catch() instead of a per-item one would reject the whole flush
    // promise, so the NEXT flush chains onto a rejected promise and never runs its
    // body - stranding everything queued afterwards.
    const seen = [];
    const api = loadCustomFunctionsCode({
      excelApi18: false,
      runPython: async ({ scriptName }) => {
        if (scriptName === "bad") throw new Error("getAuth blew up");
        seen.push(scriptName);
      },
    });

    await api.ensureCalculatedHandler();
    // Both land in the SAME batch: onCalculated fires once for a recalculation that
    // produced several follow-ups. A chain-level catch abandons the rest of the loop,
    // so "good" would never run.
    api
      .getPending()
      .push(
        { ...SCRIPT, script_name: "bad" },
        { ...SCRIPT, script_name: "good" },
      );
    api.scheduleFlush();
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(seen).toEqual(["good"]);
    expect(api.getPending()).toHaveLength(0);
  });

  it("dispatches when the onCalculated handler fires", async () => {
    const seen = [];
    const api = loadCustomFunctionsCode({
      excelApi18: true,
      runPython: async ({ scriptName }) => {
        seen.push(scriptName);
      },
    });

    await api.ensureCalculatedHandler();
    api.enqueueFollowUpScript({ ...SCRIPT, script_name: "later" });
    // Nothing runs until the calculation boundary is reached.
    await settle();
    expect(seen).toEqual([]);

    await api.calculatedHandlers[0]();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seen).toEqual(["later"]);
  });
});

describe("makeServerCall", () => {
  it("returns the result and queues the script when the response carries one", async () => {
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ excelApi18: false, runPython });
    api.globalThisStub.xwRequest.post = async () => ({
      data: { result: [["Hello!"]], script: SCRIPT },
    });

    const result = await api.makeServerCall({ func_name: "f" });

    expect(result).toEqual([["Hello!"]]);
    // Registration is awaited before the value is returned, so the strategy is settled.
    expect(api.usesTimerFallback()).toBe(true);
    // The value comes back first; the script is only dispatched afterwards.
    expect(runPython).not.toHaveBeenCalled();

    await settle();
    expect(runPython).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptName: SCRIPT.script_name,
        args: SCRIPT.args,
      }),
    );
    expect(api.getPending()).toHaveLength(0);
  });

  it("queues nothing when the response has no script", async () => {
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ excelApi18: false, runPython });
    api.globalThisStub.xwRequest.post = async () => ({
      data: { result: [["Hello!"]] },
    });

    const result = await api.makeServerCall({ func_name: "f" });
    await settle();

    expect(result).toEqual([["Hello!"]]);
    expect(api.getPending()).toHaveLength(0);
    expect(runPython).not.toHaveBeenCalled();
  });
});

describe("makeWasmCall", () => {
  // The Wasm path (xlwings Lite) gets the same {result, script} envelope as the server
  // path, just from Pyodide instead of HTTP.
  it("unwraps the envelope and queues the script", async () => {
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ excelApi18: false, runPython });
    api.globalThisStub.wasmCustomFunctionsCall = async () => ({
      result: [["Hello!"]],
      script: SCRIPT,
    });

    const result = await api.makeWasmCall({ func_name: "f" });

    // The cell gets the inner value, never the envelope.
    expect(result).toEqual([["Hello!"]]);
    expect(api.usesTimerFallback()).toBe(true);
    // The value comes back first; the script is only dispatched afterwards.
    expect(runPython).not.toHaveBeenCalled();

    await settle();
    expect(runPython).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptName: SCRIPT.script_name,
        args: SCRIPT.args,
      }),
    );
    expect(api.getPending()).toHaveLength(0);
  });

  it("returns a plain result untouched", async () => {
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ excelApi18: false, runPython });
    api.globalThisStub.wasmCustomFunctionsCall = async () => [["Hello!"]];

    const result = await api.makeWasmCall({ func_name: "f" });
    await settle();

    expect(result).toEqual([["Hello!"]]);
    expect(runPython).not.toHaveBeenCalled();
  });

  it("passes through a cell value that happens to have a result key", async () => {
    // Object handles hand back an Entity whose payload is a plain object. Branching on
    // `result` rather than `script` would mistake one for the envelope and write the
    // wrong thing to the cell.
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ excelApi18: false, runPython });
    const entity = { type: "Entity", result: "not an envelope" };
    api.globalThisStub.wasmCustomFunctionsCall = async () => entity;

    const result = await api.makeWasmCall({ func_name: "f" });
    await settle();

    expect(result).toBe(entity);
    expect(runPython).not.toHaveBeenCalled();
  });

  it("surfaces a Python-side error instead of queueing anything", async () => {
    // Resolution failures (unknown/ambiguous script) come back through the existing
    // {error, details} envelope, so they must land on the cell as an error.
    const runPython = vi.fn(async () => {});
    const api = loadCustomFunctionsCode({ excelApi18: false, runPython });
    api.globalThisStub.wasmCustomFunctionsCall = async () => ({
      error: "Custom script 'nope' doesn't exist.",
      details: "Traceback...",
    });

    // showError throws a CustomFunctions.Error, which propagates so Excel shows the
    // message on the producing cell rather than the follow-up failing silently.
    await expect(api.makeWasmCall({ func_name: "f" })).rejects.toBeDefined();
    await settle();

    expect(runPython).not.toHaveBeenCalled();
    expect(api.getPending()).toHaveLength(0);
  });
});
