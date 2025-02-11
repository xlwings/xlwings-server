const debug = false;
let invocations = new Set();
let bodies = new Set();
let runtime;
let socket = null;

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

  return {
    result,
    indices,
  };
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
  const officeApiClient = localStorage.getItem("Office API client");

  // For arguments that are Entities, replace the arg with their address (cache key).
  // The issues is that invocation.parameterAddresses returns a flat list while args
  // contains a nested array for varargs (in Office.js called 'repeating').
  const { result: flatArgs, indices } = flattenVarargsArray(args);

  // Process each flattened item with respect to its path
  flatArgs.forEach((item, index) => {
    if (item && item[0][0]?.type === "Entity") {
      const address = `${officeApiClient}[${workbookName}]${invocation.parameterAddresses[index]}`;

      let target = args;
      const path = indices[index];

      for (let i = 0; i < path.length - 1; i++) {
        target = target[path[i]];
      }

      const lastIndex = path[path.length - 1];
      target[lastIndex] = [address];
    }
  });

  // Body
  let body = {
    func_name: funcName,
    args: args,
    caller_address: `${officeApiClient}[${workbookName}]${invocation.address}`, // not available for streaming functions
    culture_info_name: await xlwings.getCultureInfoName(),
    date_format: await xlwings.getDateFormat(),
    version: "placeholder_xlwings_version",
    runtime: runtime,
  };

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
    socket.emit("xlwings:function-call", body);
    if (debug) {
      console.log(`emit xlwings:function-call ${funcName}`);
    }
    invocation.setResult([["Waiting for stream..."]]);

    socket.off(`xlwings:set-result-${taskKey}`);
    socket.on(`xlwings:set-result-${taskKey}`, (data) => {
      invocation.setResult(data.result);
      if (debug) {
        console.log(`Set Result`);
      }
    });

    invocations.add(invocation);
    bodies.add(body);

    return;
  }

  // Normal functions communicate via REST API
  if (config.onLite) {
    return await makeLiteCall(body);
  } else {
    return await makeServerCall(body);
  }
}

async function makeServerCall(body) {
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    let headers = {
      "Content-Type": "application/json",
      Authorization:
        typeof globalThis.getAuth === "function"
          ? await globalThis.getAuth()
          : "",
      sid: socket && socket.id ? socket.id.toString() : null,
    };

    await semaphore.acquire();
    try {
      let response = await fetch(
        window.location.origin + "placeholder_custom_functions_call_path",
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        let errMsg = await response.text();
        console.error(`Attempt ${attempt}: ${errMsg}`);
        if (attempt === MAX_RETRIES) {
          return showError(errMsg);
        }
      } else {
        let responseData = await response.json();
        return responseData.result;
      }
    } catch (error) {
      console.error(`Attempt ${attempt}: ${error.toString()}`);
      if (attempt === MAX_RETRIES) {
        return showError(error.toString());
      }
    } finally {
      semaphore.release();
    }
  }
}

async function makeLiteCall(body) {
  let module_str;
  if (config.isOfficialLiteAddin) {
    await xlwings.pyodideReadyPromise;
    module_str = globalThis.editorInstance.getValue();
  } else {
    module_str = null;
  }
  try {
    let result = await globalThis.liteCustomFunctionsCall(body, module_str);
    if (result.error) {
      console.error(result.details);
      showError(result.error);
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
