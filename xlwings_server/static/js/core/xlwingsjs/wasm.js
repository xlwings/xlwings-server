async function initPyodide() {
  if (config.onWasm === false) {
    return;
  }

  const globalStatusAlert = document.querySelector("#global-status-alert");
  const globalErrorAlert = document.querySelector("#global-error-alert");

  try {
    // Show loading status
    if (globalStatusAlert && !config.isOfficialLiteAddin) {
      globalStatusAlert.classList.remove("d-none");
      globalStatusAlert.querySelector("span").innerHTML = `
        <div class="spinner-border spinner-border-sm text-alert me-1" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        Loading...
      `;
    }

    // Hide any previous error
    if (globalErrorAlert) {
      globalErrorAlert.classList.add("d-none");
    }

    let pyodide = await loadPyodide();

    const pyodideConfigResponse = await fetch(
      config.appPath + "/xlwings/pyodide.json",
    );
    if (!pyodideConfigResponse.ok) {
      throw new Error(
        `Failed to fetch pyodide config: ${pyodideConfigResponse.statusText}`,
      );
    }
    const pyodideConfigData = await pyodideConfigResponse.json();

    // Install dependencies
    if (!config.isOfficialLiteAddin) {
      await pyodide.loadPackage("micropip");
      const micropip = pyodide.pyimport("micropip");
      let packages = pyodideConfigData["packages"];
      await micropip.install(packages, { keep_going: true });
    }

    // Python files
    const files = pyodideConfigData["files"];
    function createDirectories(files) {
      const createdDirs = new Set();
      Object.values(files).forEach((localPath) => {
        const parts = localPath.split("/");
        if (parts.length > 1) {
          const dirPath = parts.slice(0, parts.length - 1).join("/");
          if (!createdDirs.has(dirPath)) {
            // TODO: does this work for nested dirs? Also, ./ is probably wrong
            if (dirPath !== ".") {
              pyodide.FS.mkdir(dirPath);
              pyodide.FS.mount(pyodide.FS.filesystems.MEMFS, {}, dirPath);
            }
            createdDirs.add(dirPath);
          }
        }
      });
    }

    createDirectories(files);

    for (const [endpoint, localPath] of Object.entries(files)) {
      const response = await fetch(config.appPath + endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
      }
      const content = await response.text();
      pyodide.FS.writeFile(localPath, content);
    }

    if (!config.isOfficialLiteAddin) {
      // Entrypoint
      let runtimeText = pyodide.FS.readFile("./wasm_runtime.py", {
        encoding: "utf8",
      });
      await pyodide.runPythonAsync(runtimeText);

      // Functions
      // You can't simply export them as the will be null when used in
      // custom-functions-code.js (it's only assigned the function here).
      globalThis.wasmCustomFunctionsCall = pyodide.globals.get(
        "custom_functions_call",
      );
      globalThis.wasmCustomFunctionsMeta = pyodide.globals.get(
        "custom_functions_meta",
      );
      globalThis.wasmCustomFunctionsCode = pyodide.globals.get(
        "custom_functions_code",
      );
      globalThis.wasmCustomScriptsCall = pyodide.globals.get(
        "custom_scripts_call",
      );
      globalThis.wasmCustomScriptsMeta = pyodide.globals.get(
        "custom_scripts_meta",
      );

      // Hide loading status on success
      if (globalStatusAlert) {
        globalStatusAlert.classList.add("d-none");
      }
    }

    return pyodide;
  } catch (err) {
    console.error("Pyodide initialization failed:", err);

    // Hide loading status
    if (globalStatusAlert) {
      globalStatusAlert.classList.add("d-none");
    }

    // Show error alert
    if (globalErrorAlert) {
      globalErrorAlert.classList.remove("d-none");
      globalErrorAlert.innerHTML = `
          Error initializing Pyodide: ${err.message}
      `;
    }

    throw err;
  }
}

// Call as follows:
// let pyodide = await pyodideReadyPromise;
let resolvePyodideStart;
let rejectPyodideStart;
export let pyodideReadyPromise = config.isOfficialLiteAddin
  ? new Promise((resolve, reject) => {
      resolvePyodideStart = resolve;
      rejectPyodideStart = reject;
    })
  : initPyodide();

// Only used when isOfficialLiteAddin: load Pyodide dynamically with the given version,
// then run initPyodide() and resolve pyodideReadyPromise.
// version: bare version string without "v" prefix, e.g. "0.27.5"
// integrity: optional SRI hash string for CDN loads, e.g. "sha384-..."
export async function startPyodide(version, integrity) {
  try {
    const url = `${config.pyodideBaseUrl.replace(/\/$/, "")}/v${version}/full/pyodide.mjs`;

    // Enforce SRI via modulepreload link, which primes the browser
    // cache with the verified resource before the dynamic import fetches it.
    if (integrity) {
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = url;
      link.integrity = integrity;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      // Give the browser a tick to register the preload before importing
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    let loadPyodide;
    try {
      ({ loadPyodide } = await import(url));
    } catch (err) {
      throw new Error(
        `Failed to load Pyodide v${version} from ${config.pyodideBaseUrl} [${err.message}]`,
      );
    }
    globalThis.loadPyodide = loadPyodide;
    const result = await initPyodide();
    resolvePyodideStart(result);
    return result;
  } catch (err) {
    rejectPyodideStart(err);
    throw err;
  }
}
