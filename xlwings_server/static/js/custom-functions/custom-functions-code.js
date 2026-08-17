// NOTE: this file is not served statically. The custom_functions_code route reads
// it from disk, substitutes the placeholder_* strings, and appends generated
// CustomFunctions.associate stubs. Because it is assembled and served from a
// dynamic route (no stable static URL, not content-hashed, and the appended
// associate() calls must run at top level), it stays a classic, self-contained
// script (no imports) and communicates via globalThis bridges.
//
// The manifest declares SharedRuntime, so custom functions run in the same JS
// context as the task pane. The bridges below are therefore populated by the
// task-pane modules (or, on the official lite add-in, by app.js) and are simply
// read here from the shared globalThis:
// config, getAuth, socket, xlwings, xwRequest (the XHR HTTP helper, set by
// utils.js), wasmCustomFunctionsCall, wasmStreamingCall/wasmStreamingCancel
// (set by the official lite add-in), plus the Office/Excel/CustomFunctions
// libraries.

const debug = false;

// Identifies this client. Sent with every call so the backend can scope its
// superseded-handle tracking: caller addresses alone are not unique across
// users/sessions (with auth disabled, two users each working on their own
// "workbook1.xlsx" would otherwise evict each other's cached objects on every
// recalculation). Persisted in localStorage so the id survives custom-functions
// runtime restarts (a fresh id would orphan each cell's previous generation until
// LRU eviction/expiry); where localStorage is unavailable (e.g. private browsing),
// a per-instance id degrades to exactly that.
function getSessionId() {
  // The id is not a secret (it's client-supplied and only namespaces the cleanup
  // tracking); it just needs to be unique. crypto.getRandomValues covers engines
  // where crypto.randomUUID is unavailable (it requires a secure context).
  const newId = () => {
    if (globalThis.crypto?.randomUUID) {
      return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  try {
    let id = localStorage.getItem("xlwingsSessionId");
    if (!id) {
      id = newId();
      localStorage.setItem("xlwingsSessionId", id);
    }
    return id;
  } catch {
    return newId();
  }
}
const sessionId = getSessionId();

let invocations = new Set();
let bodies = new Set();
let streamingSubscriptions = new Map();
let wasmStreamingGen = Object.create(null);
let runtime;
let socket = null;

function getStreamingSubscriptionId(taskKey, invocation) {
  return `${taskKey}::${invocation.address}`;
}

function removeStreamingSubscription(subscriptionId, emitCancel = false) {
  const subscription = streamingSubscriptions.get(subscriptionId);
  if (!subscription) {
    return;
  }

  if (socket !== null) {
    socket.off(subscription.eventName, subscription.listener);
  }
  invocations.delete(subscription.invocation);
  bodies.delete(subscription.body);
  streamingSubscriptions.delete(subscriptionId);

  if (emitCancel && socket !== null) {
    socket.emit("xlwings:cancel-task", { task_key: subscription.taskKey });
  }
}

Office.onReady(function (info) {
  // Socket.io
  socket = globalThis.socket ? globalThis.socket : null;

  if (socket !== null) {
    socket.on("disconnect", () => {
      if (debug) {
        console.log("disconnect");
      }
      for (let invocation of invocations) {
        invocation.setResult([["Stream disconnected"]]);
      }
      invocations.clear();
    });

    socket.on("connect", () => {
      // Without this, you'd have to hit Ctrl+Alt+F9, which isn't available on the web
      if (debug) {
        console.log("connect");
      }
      for (let body of bodies) {
        socket.emit("xlwings:function-call", body);
      }
    });
  }

  // Runtime version
  if (
    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.4")
  ) {
    runtime = "1.4";
  } else if (
    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.3")
  ) {
    runtime = "1.3";
  } else if (
    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.2")
  ) {
    runtime = "1.2";
  } else {
    runtime = "1.1";
  }
});

function flattenVarargsArray(arr) {
  // Turn [ [[0]], [ [[0]], [[0]] ] ] into:
  // result: [ [[0]], [[0]], [[0]] ]
  // indices: [ [ 0 ], [ 1, 0 ], [ 1, 1 ] ]
  const result = [];
  const indices = [];

  function isTripleNested(item) {
    return (
      Array.isArray(item) && Array.isArray(item[0]) && Array.isArray(item[0][0])
    );
  }

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];

    if (isTripleNested(item)) {
      result.push(...item);
      for (let j = 0; j < item.length; j++) {
        indices.push([i, j]);
      }
    } else {
      result.push(item);
      indices.push([i]);
    }
  }

  // Create a prototype-less object to return to prevent prototype-pollution-loop
  const returnObject = Object.create(null);
  returnObject.result = result;
  returnObject.indices = indices;

  return returnObject;
}

// Workbook name
let cachedWorkbookName = null;

async function getWorkbookName() {
  if (cachedWorkbookName) {
    return cachedWorkbookName;
  }
  const context = new Excel.RequestContext();
  const workbook = context.workbook;
  workbook.load("name");
  await context.sync();
  cachedWorkbookName = workbook.name;
  return cachedWorkbookName;
}

class Semaphore {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.currentConcurrency = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.currentConcurrency < this.maxConcurrency) {
      this.currentConcurrency++;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release() {
    this.currentConcurrency--;
    if (this.queue.length > 0) {
      this.currentConcurrency++;
      const nextResolve = this.queue.shift();
      nextResolve();
    }
  }
}

const semaphore = new Semaphore(1000);

async function base() {
  await Office.onReady(); // Block execution until office.js is ready
  // Arguments
  let argsArr = Array.prototype.slice.call(arguments);
  let funcName = argsArr[0];
  let isStreaming = argsArr[1];
  let args = argsArr.slice(2, -1);
  let invocation = argsArr[argsArr.length - 1];

  const workbookName = await getWorkbookName();

  // For arguments that are object handles, replace the Entity arg with its cache key so
  // that the backend can resolve the cached object. The key is stored in the Entity's
  // hidden "object_handle_cache_key" property, which travels with the Entity itself - so
  // the object handle keeps working through =A1, copy/paste, and temporaries (e.g.
  // USE(MAKE())). The issue is that args contains a nested array for varargs (in Office.js
  // called 'repeating'), so we flatten first and write back via each item's path.
  const { result: flatArgs, indices } = flattenVarargsArray(args);

  // Process each flattened item with respect to its path
  flatArgs.forEach((item, index) => {
    const cellValue = item?.[0]?.[0];
    // Only entity-like cell values are object-handle candidates: our own object handles
    // are "Entity", and Stocks/Geography are "LinkedEntity". Everything else (plain values,
    // errors, arrays, web images, ...) is left untouched so the backend reads it normally -
    // notably, error cells are "Error" and must NOT be treated as handles.
    const type = cellValue?.type;
    if (type !== "Entity" && type !== "LinkedEntity") {
      return;
    }

    // Our object handles are Entities carrying the hidden cache key.
    const cacheKey =
      type === "Entity"
        ? cellValue.properties?.object_handle_cache_key?.basicValue
        : undefined;

    let target = args;
    const path = indices[index];
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]];
    }
    const lastIndex = path[path.length - 1];

    // An entity-like value without our hidden key isn't an xlwings object handle (e.g. a
    // Stocks or Geography entity passed by mistake): send a marker string so the backend
    // can raise a clear error instead of choking on an arbitrary payload. It must be a
    // string (not an object) so it passes through xlwings' value cleaning unchanged.
    target[lastIndex] = cacheKey
      ? [cacheKey]
      : ["__xlwings_not_an_object_handle__"];
  });

  // Body
  let body = {
    client: "Office.js",
    func_name: funcName,
    args: args,
    // invocation.address is not available for streaming functions and can be missing
    // in some evaluation contexts: send null then, never a shared "...undefined"
    // string - the backend uses caller_address as the scope for superseded-handle
    // tracking, and calls sharing one scope would evict each other's cached objects.
    caller_address: invocation.address
      ? `[${workbookName}]${invocation.address}`
      : null,
    session_id: sessionId,
    culture_info_name: await xlwings.getCultureInfoName(),
    date_format: await xlwings.getDateFormat(),
    version: "placeholder_xlwings_version",
    runtime: runtime,
  };

  // Streaming functions on Wasm use direct Pyodide callbacks
  if (isStreaming && config.onWasm) {
    let taskKey = `${funcName}_${args}`;
    body.task_key = taskKey;
    // Bump generation so a late-firing onCanceled from the previous invocation
    // does not kill this new task (onCanceled can fire AFTER the re-invocation).
    wasmStreamingGen[taskKey] = (wasmStreamingGen[taskKey] || 0) + 1;
    let myGen = wasmStreamingGen[taskKey];
    invocation.setResult([["Waiting for stream..."]]);

    const setResult = (result) => {
      invocation.setResult(result);
    };
    globalThis.wasmStreamingCall(body, setResult).catch((error) => {
      console.error(error);
      const msg = error?.message || String(error);
      const lastLine = msg.trim().split("\n").pop();
      invocation.setResult([[`ERROR: ${lastLine}`]]);
    });

    invocation.onCanceled = () => {
      if (wasmStreamingGen[taskKey] === myGen) {
        globalThis.wasmStreamingCancel(taskKey);
      }
    };
    return;
  }

  // Streaming functions communicate via socket.io
  if (isStreaming) {
    if (socket === null) {
      console.error(
        "To enable streaming functions, you need to load the socket.io js client before xlwings.js and custom-functions-code",
      );
      return;
    }
    let taskKey = `${funcName}_${args}`;
    body.task_key = taskKey;
    const subscriptionId = getStreamingSubscriptionId(taskKey, invocation);

    // Replace any previous listener for the same invocation slot.
    // This prevents duplicate listeners if the runtime re-invokes before cancellation.
    removeStreamingSubscription(subscriptionId, true);

    socket.emit("xlwings:function-call", body);
    if (debug) {
      console.log(`emit xlwings:function-call ${funcName}`);
    }
    invocation.setResult([["Waiting for stream..."]]);

    const eventName = `xlwings:set-result-${taskKey}`;
    const listener = (data) => {
      try {
        invocation.setResult(data.result);
      } catch (error) {
        // If an invocation became stale without cancellation callbacks,
        // clean it up and decrement server-side refcount.
        removeStreamingSubscription(subscriptionId, true);
        if (debug) {
          console.log("Removed stale streaming listener", error);
        }
      }
      if (debug) {
        console.log(`Set Result`);
      }
    };
    socket.on(eventName, listener);

    invocations.add(invocation);
    bodies.add(body);
    streamingSubscriptions.set(subscriptionId, {
      taskKey,
      eventName,
      listener,
      invocation,
      body,
    });

    invocation.onCanceled = () => {
      removeStreamingSubscription(subscriptionId, true);
    };

    return;
  }

  // Normal functions communicate via REST API
  if (config.onWasm) {
    return await makeWasmCall(body);
  } else {
    return await makeServerCall(body);
  }
}

// Follow-up scripts (xw.WithScript)
//
// A custom function may not write to the grid during its own invocation, so a requested
// script is queued and dispatched at the next calculation boundary instead. Excel's
// onCalculated event is that boundary; where it isn't available we fall back to a timer,
// which only defers past the current JS task and carries no commit guarantee.
const pendingScripts = [];
let calculatedHandlerPromise = null;
let useTimerFallback = false;
let flushPromise = Promise.resolve();

function scheduleFlush() {
  // A single chain shared by the event handler and the timer fallback. Draining one
  // batch isn't enough: a dispatched script can itself trigger a calculation, firing
  // onCalculated again while this flush is still running. Chaining plus a while loop
  // that re-checks the queue keeps dispatches strictly serial and absorbs requests
  // appended mid-flush.
  flushPromise = flushPromise.then(async () => {
    while (pendingScripts.length) {
      const script = pendingScripts.shift();
      try {
        await dispatchFollowUpScript(script);
      } catch (error) {
        // Per item: one failure (e.g. getAuth rejecting) must not strand the rest.
        console.error(error);
      }
    }
  });
  return flushPromise;
}

function ensureCalculatedHandler() {
  // Idempotent: only picks the dispatch strategy, and never rejects. makeServerCall
  // awaits this before returning the cell value, so a registration failure must not
  // turn into a #VALUE! for a problem that only affects the follow-up.
  if (calculatedHandlerPromise) {
    return calculatedHandlerPromise;
  }
  calculatedHandlerPromise = (async () => {
    if (!Office.context.requirements.isSetSupported("ExcelApi", "1.8")) {
      console.log(
        "Follow-up scripts: ExcelApi 1.8 is unavailable, falling back to best-effort scheduling.",
      );
      useTimerFallback = true;
      return;
    }
    try {
      await Excel.run(async (context) => {
        // Workbook-wide collection event: a per-sheet handler would miss calculations
        // on sheets added later.
        context.workbook.worksheets.onCalculated.add(async () => {
          scheduleFlush();
        });
        await context.sync();
      });
    } catch (error) {
      console.error(error);
      useTimerFallback = true;
    }
  })();
  return calculatedHandlerPromise;
}

function enqueueFollowUpScript(script) {
  // Append before scheduling: the other order can fire an empty timer flush and leave
  // the request sitting in the queue.
  pendingScripts.push(script);
  if (useTimerFallback) {
    setTimeout(scheduleFlush, 0);
  }
  // No safety net needed on the onCalculated path, including in manual calculation
  // mode (tested): an async custom function keeps its calculation open until the
  // returned promise settles, so the boundary always comes after this response.
}

async function dispatchFollowUpScript(script) {
  if (!script || !script.script_name) {
    return;
  }
  if (!globalThis.xlwings || !globalThis.xlwings.runPython) {
    console.error(
      "Follow-up scripts require the shared runtime (globalThis.xlwings is unavailable).",
    );
    return;
  }
  let authResult =
    typeof globalThis.getAuth === "function"
      ? await globalThis.getAuth()
      : { token: "", provider: "" };
  return globalThis.xlwings.runPython({
    scriptName: script.script_name,
    args: script.args || [],
    include: script.include || "",
    exclude: script.exclude || "",
    // Resolved server-side from the script's own @script metadata, not chosen by the
    // custom function - same as for a task pane button
    lazy: script.lazy || false,
    auth: authResult.token,
    headers: { "Auth-Provider": authResult.provider },
    // Same as a task pane button: the default "alert" mode uses window.alert, which
    // Office.js doesn't support. There's no click to tie an error to here either, so
    // the task pane is the only place a failing follow-up can surface.
    errorDisplayMode: "taskpane",
  });
}

async function makeServerCall(body) {
  const MAX_RETRIES = config.customFunctionsMaxRetries;
  const RETRY_CODES = config.customFunctionsRetryCodes;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    let authResult =
      typeof globalThis.getAuth === "function"
        ? await globalThis.getAuth()
        : { token: "", provider: "" };
    let headers = {
      "Content-Type": "application/json",
      Authorization: authResult.token,
      "Auth-Provider": authResult.provider,
    };

    await semaphore.acquire();
    try {
      const response = await globalThis.xwRequest.post(
        window.location.origin + "placeholder_custom_functions_call_path",
        body,
        { headers: headers, timeout: config.requestTimeout * 1000 },
      );
      const { result, script } = response.data;
      if (script) {
        // Register before returning the value: the custom function stays pending until
        // we return, so its calculation boundary can't precede registration. Doing this
        // lazily afterwards would race the very event we're waiting for.
        await ensureCalculatedHandler();
        enqueueFollowUpScript(script);
      }
      return result;
    } catch (error) {
      if (error.response) {
        // HTTP error status: the body is usually JSON ({detail}/{error}).
        const data = error.response.data;
        const errMsg =
          (data && data.detail) ||
          (data && data.error) ||
          (data && typeof data === "object" ? JSON.stringify(data) : data) ||
          error.response.statusText ||
          "Unknown server error";
        console.error(`Attempt ${attempt}: ${errMsg}`);

        // Only retry if the status code is in the retry codes list
        const shouldRetry = RETRY_CODES.includes(error.response.status);
        if (attempt === MAX_RETRIES || !shouldRetry) {
          return showError(errMsg);
        }
      } else {
        // Network failure or timeout (no HTTP response).
        console.error(`Attempt ${attempt}: ${error.toString()}`);
        if (attempt === MAX_RETRIES) {
          return showError(error.toString());
        }
      }
    } finally {
      semaphore.release();
    }
  }
}

async function makeWasmCall(body) {
  try {
    let result = await globalThis.wasmCustomFunctionsCall(body);
    if (result.error) {
      console.error(result.details);
      showError(result.error);
    }
    // A follow-up script requested via xw.WithScript arrives as {result, script};
    // anything else is the bare cell value. Checked via `script` rather than the
    // presence of `result`, since a plain cell value can itself be an object with a
    // `result` key (e.g. an object handle's Entity payload).
    if (result && result.script) {
      // Register before returning the value: the custom function stays pending until we
      // return, so its calculation boundary can't precede registration. Doing this
      // lazily afterwards would race the very event we're waiting for.
      await ensureCalculatedHandler();
      enqueueFollowUpScript(result.script);
      return result.result;
    }
    return result;
  } catch (error) {
    console.error(error);
    showError(error);
  }
}

function showError(errorMessage) {
  if (
    Office.context.requirements.isSetSupported("CustomFunctionsRuntime", "1.2")
  ) {
    // Error message is only visible by hovering over the error flag!
    let excelError = new CustomFunctions.Error(
      CustomFunctions.ErrorCode.invalidValue,
      errorMessage,
    );
    throw excelError;
  } else {
    return [[errorMessage]];
  }
}
