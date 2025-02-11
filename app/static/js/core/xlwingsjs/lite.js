async function initPyodide() {
  if (config.onLite === false) {
    return;
  }
  const globalStatusAlert = document.querySelector("#global-status-alert");
  if (globalStatusAlert) {
    globalStatusAlert.classList.remove("d-none");
    globalStatusAlert.querySelector("span").innerHTML = `
      <div class="spinner-border spinner-border-sm text-alert me-1" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      Loading...
    `;
  }

  let pyodide = await loadPyodide();
  const pyodideConfigResponse = await fetch(
    config.appPath + "/xlwings/pyodide.json",
  );
  const pyodideConfigData = await pyodideConfigResponse.json();
  // Install dependencies
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  let packages = pyodideConfigData["packages"];
  await micropip.install(packages);
  // Python files
  const files = pyodideConfigData["files"];
  function createDirectories(files) {
    const createdDirs = new Set();
    Object.values(files).forEach((localPath) => {
      const parts = localPath.split("/");
      if (parts.length > 1) {
        const dirPath = parts.slice(0, parts.length - 1).join("/");
        if (!createdDirs.has(dirPath)) {
          try {
            // TODO: does this work for nested dirs? Also, ./ is probably wrong
            if (dirPath !== ".") {
              pyodide.FS.mkdir(dirPath);
            }
          } catch (err) {
            console.log(err);
          }
          try {
            if (dirPath !== ".") {
              pyodide.FS.mount(pyodide.FS.filesystems.MEMFS, {}, dirPath);
            }
          } catch (err) {
            console.log(err);
          }
          createdDirs.add(dirPath);
        }
      }
    });
  }
  createDirectories(files);
  for (const [endpoint, localPath] of Object.entries(files)) {
    const response = await fetch(config.appPath + endpoint);
    const content = await response.text();
    pyodide.FS.writeFile(localPath, content);
  }
  try {
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
  } catch (err) {
    console.log(err);
  }

  // Loading status
  if (globalStatusAlert) {
    globalStatusAlert.classList.add("d-none");
  }

  return pyodide;
}

// Call as follows:
// let pyodide = await pyodideReadyPromise;
export let pyodideReadyPromise = initPyodide();
