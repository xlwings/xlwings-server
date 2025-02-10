const monacoEditor = {
  isSaved: false,
  tabs: {
    main: {
      name: "main.py",
      isActive: true,
      defaultContent: "# Type your code here\n",
    },
    requirements: {
      name: "requirements.txt",
      isActive: false,
      defaultContent: "",
    },
  },

  tabText() {
    return this.getTabNameWithStatus(this.$el.dataset.tab);
  },

  scripts: [],
  selectedScript: "",
  scriptButtonText() {
    return this.scripts.length ? `${this.selectedScript}` : "(no script)";
  },
  selectScript() {
    this.selectedScript = this.$el.textContent;
  },
  async activateTabById(tabId) {
    // Update active states
    Object.keys(this.tabs).forEach((key) => {
      this.tabs[key].isActive = key === tabId;
    });

    // Load content for activated tab
    if (editorInstance) {
      const content = await this.loadContent(this.tabs[tabId].name);
      let editorContent = content || this.tabs[tabId].defaultContent;
      editorInstance.setValue(editorContent);
    }
  },

  async activateTab(event) {
    const tabId = this.$el.dataset.tab;
    await this.activateTabById(tabId);
  },

  getActiveTab() {
    return Object.values(this.tabs).find((tab) => tab.isActive);
  },

  isTabActive(tabId) {
    return this.tabs[tabId].isActive;
  },

  getTabNameWithStatus(tabId) {
    const tab = this.tabs[tabId];
    return `${tab.name}${this.isSaved && tab.isActive ? ' <span class="text-success">✓</span>' : ""}`;
  },

  tabState: {
    [":class"]() {
      return { active: this.isTabActive(this.$el.dataset.tab) };
    },
  },
  buttonDisabled() {
    return this.isRunning || this.scripts.length === 0;
  },
  isRunning: false,
  spinner: {
    [":class"]() {
      return {
        // Reusing htmx-indicator as it sets opacity: 0, leaving the space for spinner
        "htmx-indicator": !this.isRunning,
      };
    },
  },
  async init() {
    await Office.onReady();
    this.resizeOutputPanel();

    // requirements.txt
    if (config.onLite) {
      try {
        const requirements = await this.loadContent("requirements.txt");
        let pyodide = await xlwings.pyodideReadyPromise;
        const micropip = pyodide.pyimport("micropip");
        packages = (requirements || "").split("\n").filter(Boolean);
        await micropip.install(packages);
      } catch (e) {
        console.error(e);
      }
    }

    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
      },
    });

    require(["vs/editor/editor.main"], () => {
      globalThis.editorInstance = monaco.editor.create(
        this.$refs.editorContainer,
        {
          value: "",
          language: "python",
          theme: "vs-light",
          minimap: { enabled: false },
          automaticLayout: true,
        },
      );
      this.activateTabById("main");

      // Autosave
      let saveTimeout;
      editorInstance.onDidChangeModelContent(() => {
        // Hide saved indicator when editing starts
        this.isSaved = false;

        // Clear previous timeout
        clearTimeout(saveTimeout);

        // Set new timeout to save after 1000ms of no typing
        saveTimeout = setTimeout(() => {
          this.saveContent(this.getActiveTab().name);
        }, 1000);
      });
    });
  },

  resizeOutputPanel() {
    const resizer = this.$refs.resizer;
    const editorPane = this.$refs["editor-pane"];
    const outputContainer = this.$refs["output-container"];

    resizer.addEventListener("mousedown", (e) => {
      let startY = e.clientY;
      let startEditorHeight = editorPane.getBoundingClientRect().height;
      let startOutputHeight = outputContainer.getBoundingClientRect().height;

      const onMouseMove = (e) => {
        const dy = e.clientY - startY;
        editorPane.style.height = `${startEditorHeight + dy}px`;
        outputContainer.style.height = `${startOutputHeight - dy}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      e.preventDefault();
    });
  },

  async loadContent(filename) {
    try {
      return await Excel.run(async (context) => {
        const settings = context.workbook.settings;
        const content = settings.getItemOrNullObject(filename);
        content.load("value");
        await context.sync();
        if (content.isNullObject) {
          return null;
        }
        // Update scripts after loading content
        if (content.value) {
          this.updateScripts(content.value);
        }
        return content.value;
      });
    } catch (error) {
      console.log(`Error loading ${filename}:`, error);
      return null;
    }
  },

  async updateScripts(content) {
    if (this.activateTab !== "requirements") {
      let pyodide = await xlwings.pyodideReadyPromise;
      const newScripts = globalThis.getXlwingsScripts(content);
      // Keep current selection if it exists in new scripts
      const keepSelection =
        this.selectedScript && newScripts.includes(this.selectedScript);

      this.scripts = newScripts;
      if (!keepSelection) {
        this.selectedScript = this.scripts.length ? this.scripts[0] : "";
      }
    }
  },

  async saveContent(filename) {
    const content = editorInstance.getValue();
    let pyodide = await xlwings.pyodideReadyPromise;
    // Store
    await Excel.run(async (context) => {
      const settings = context.workbook.settings;
      settings.add(filename, content);
      settings.add("pyodideVersion", pyodide.version);
      await context.sync();
      console.log(`${filename} stored`);
      this.isSaved = true;
      this.updateScripts(content);
    });
    if (filename !== "requirements.txt") {
      meta = globalThis.liteCustomFunctionsMeta(content);
      rendered_custom_functions_code =
        globalThis.liteCustomFunctionsCode(content);
      await reloadCustomFunctions(
        JSON.stringify(meta),
        rendered_custom_functions_code,
      );
      await pyodide.FS.writeFile(
        "custom-functions-wrappers.js",
        globalThis.liteCustomFunctionsCode(content),
      );
      loadFSScriptToDOM("custom-functions-wrappers.js");
    }
    // Install requirements.txt TODO: factor out
    if (config.onLite) {
      if (filename === "requirements.txt") {
        // Setup output redirect
        const outputDiv = document.querySelector("#output");
        outputDiv.innerHTML = "";

        const logError = (text) => {
          const lines = text.split("\n");
          const formattedText = lines
            .map((line) => {
              if (line.trim().startsWith("INFO:")) {
                return line;
              }
              return `<span style="color: red">${line}</span>`;
            })
            .join("<br>");
          outputDiv.innerHTML += formattedText + "<br>";
          outputDiv.scrollTop = outputDiv.scrollHeight;
        };

        const logOutput = (text) => {
          outputDiv.innerHTML += `${text}<br>`;
          outputDiv.scrollTop = outputDiv.scrollHeight;
        };

        // Setup Python logging
        await pyodide.runPythonAsync(`
          import logging
          logging.basicConfig(level=logging.INFO, force=True)
          micropip_logger = logging.getLogger('micropip')
          micropip_logger.setLevel(logging.INFO)
        `);

        // Redirect Python stdout/stderr
        pyodide.setStderr({
          batched: (text) => logError(text.trimEnd()),
        });
        pyodide.setStdout({
          batched: (text) => logOutput(text.trimEnd()),
        });

        try {
          const micropip = pyodide.pyimport("micropip");
          packages = content.split("\n").filter(Boolean);
          logOutput(`Installing packages: ${packages.join(", ")}`);
          await micropip.install(packages);
          logOutput("Installation complete");
        } catch (error) {
          logError(`Installation failed:\n${error.message}`);
        }
      }
    }
  },

  async run() {
    let pyodide = await xlwings.pyodideReadyPromise;
    // Clear Stdout
    const outputDiv = this.$refs.output;
    outputDiv.innerHTML = "";
    // Clear errors
    const globalErrorAlert = document.querySelector("#global-error-alert");
    if (globalErrorAlert) {
      globalErrorAlert.classList.add("d-none");
    }

    // Set loading state
    this.isRunning = true;

    try {
      let code = editorInstance.getValue();
      // TODO: put into a file
      await pyodide.runPythonAsync(`
        # Fixes pd.read_csv()
        import pyodide_http;pyodide_http.patch_all()

        # Fixes xlwings because Matplotlib isn't installed yet when imported in main.py
        import os
        import sys
        import tempfile
        import uuid
        import xlwings

        try:
            import matplotlib as mpl
            import matplotlib.figure  # noqa: F401
            import matplotlib.pyplot as plt
        except ImportError:
            mpl = None

        def process_image(image, format, export_options):
            """Returns filename and is_temp_file"""
            if isinstance(image, str):
                return image, False
            elif mpl and isinstance(image, mpl.figure.Figure):
                image_type = "mpl"
            else:
                raise TypeError("Don't know what to do with that image object")

            if export_options is None:
                export_options = {"bbox_inches": "tight", "dpi": 200}

            if format == "vector":
                if sys.platform.startswith("darwin"):
                    format = "pdf"
                else:
                    format = "svg"

            temp_dir = os.path.realpath(tempfile.gettempdir())
            filename = os.path.join(temp_dir, str(uuid.uuid4()) + "." + format)

            if image_type == "mpl":
                canvas = mpl.backends.backend_agg.FigureCanvas(image)
                canvas.draw()
                image.savefig(filename, **export_options)
                plt.close(image)
            elif image_type == "plotly":
                image.write_image(filename)
            return filename, True

        xlwings.utils.process_image = process_image
        `);
      await xlwings.runPython("", {
        ...{},
        scriptName: this.selectedScript,
        auth: "",
        errorDisplayMode: "taskpane",
        moduleString: code,
      });
    } finally {
      this.isRunning = false;
    }

    // Scroll to bottom
    outputDiv.scrollTop = outputDiv.scrollHeight;
  },
};
registerAlpineComponent("monacoEditor", monacoEditor);

async function loadFSScriptToDOM(scriptPath) {
  let pyodide = await xlwings.pyodideReadyPromise;
  // Get content from virtual filesystem
  const content = await pyodide.FS.readFile(scriptPath, { encoding: "utf8" });

  // Create blob URL
  const blob = new Blob([content], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  // Remove existing script if any
  const oldScript = document.querySelector("script[data-fs-script]");
  if (oldScript) {
    URL.revokeObjectURL(oldScript.src);
    oldScript.remove();
  }

  // Create and append new script
  const script = document.createElement("script");
  script.src = blobUrl;
  script.setAttribute("data-fs-script", "");
  script.defer = true;
  document.head.appendChild(script);
}
