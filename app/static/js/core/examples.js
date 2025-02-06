// Must not be reactive, i.e., must not be inside the monacoEditor component
let editorInstance = null;

const monacoEditor = {
  tabs: {
    main: {
      name: "main.py",
      isActive: true,
      defaultContent: "# Type your code here\n",
    },
    requirements: {
      name: "requirements.txt",
      isActive: false,
      defaultContent: "# Add your requirements here\n",
    },
  },

  async activateTabById(tabId) {
    // Update active states
    Object.keys(this.tabs).forEach((key) => {
      this.tabs[key].isActive = key === tabId;
    });

    // Load content for activated tab
    if (editorInstance) {
      const content = await this.loadContent(this.tabs[tabId].name);
      editorInstance.setValue(content || this.tabs[tabId].defaultContent);
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

  tabState: {
    [":class"]() {
      return { active: this.isTabActive(this.$el.dataset.tab) };
    },
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
    const requirements = await this.loadContent("requirements.txt");
    let pyodide = await xlwings.pyodideReadyPromise;
    const micropip = pyodide.pyimport("micropip");
    packages = requirements.split("\n").filter(Boolean);
    await micropip.install(packages);

    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
      },
    });

    require(["vs/editor/editor.main"], () => {
      editorInstance = monaco.editor.create(this.$refs.editorContainer, {
        value: "",
        language: "python",
        theme: "vs-light",
        minimap: { enabled: false },
        automaticLayout: true,
      });
      this.activateTabById("main");

      // Autosave
      let saveTimeout;
      editorInstance.onDidChangeModelContent(() => {
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
        const content = settings.getItem(filename);
        content.load("value");
        await context.sync();
        return content.value;
      });
    } catch (error) {
      console.log(`Error loading ${filename}:`, error);
      return null;
    }
  },

  async saveContent(filename) {
    const content = editorInstance.getValue();
    // Store
    await Excel.run(async (context) => {
      const settings = context.workbook.settings;
      settings.add(filename, content);
      await context.sync();
      console.log(`${filename} stored`);
    });

    // Install requirements.txt TODO: factor out
    if (filename === "requirements.txt") {
      let pyodide = await xlwings.pyodideReadyPromise;
      const micropip = pyodide.pyimport("micropip");
      packages = content.split("\n").filter(Boolean);
      await micropip.install(packages);
    }
  },

  async run() {
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
      await xlwings.runPython("", {
        ...{},
        scriptName: "main", // TODO: allow to specify
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
