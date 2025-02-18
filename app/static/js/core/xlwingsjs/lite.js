async function initPyodide() {
  if (config.onLite === false) {
    return;
  }

  const globalStatusAlert = document.querySelector("#global-status-alert");
  const globalErrorAlert = document.querySelector("#global-error-alert");

  try {
    // Show loading status
    if (globalStatusAlert) {
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
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    let packages = pyodideConfigData["packages"];
    await micropip.install(packages, { keep_going: true });

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

    // Entrypoint
    let mainText = pyodide.FS.readFile("./main.py", { encoding: "utf8" });
    await pyodide.runPythonAsync(mainText);

    // Functions
    // You can't simply export them as the will be null when used in
    // custom-functions-code.js (it's only assigned the function here).
    globalThis.liteCustomFunctionsCall = pyodide.globals.get(
      "custom_functions_call",
    );
    globalThis.liteCustomScriptsCall = pyodide.globals.get(
      "custom_scripts_call",
    );
    globalThis.getXlwingsScripts = pyodide.globals.get("get_xlwings_scripts");
    globalThis.liteCustomFunctionsMeta = pyodide.globals.get(
      "custom_functions_meta",
    );
    globalThis.liteCustomFunctionsCode = pyodide.globals.get(
      "custom_functions_code",
    );

    // Hide loading status on success
    if (globalStatusAlert) {
      globalStatusAlert.classList.add("d-none");
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
export let pyodideReadyPromise = initPyodide();
