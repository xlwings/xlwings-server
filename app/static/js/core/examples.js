// Must not be reactive, i.e., must not be inside the monacoEditor component
let editorInstance = null;

const monacoEditor = {
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
    let savedContent = await this.loadContent();
    this.resizeOutputPanel();
    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs",
      },
    });

    require(["vs/editor/editor.main"], () => {
      editorInstance = monaco.editor.create(this.$refs.editorContainer, {
        value: savedContent || "# Type your code here\n",
        language: "python",
        theme: "vs-light",
        minimap: { enabled: false },
        automaticLayout: true,
      });

      // Autosave
      let saveTimeout;
      editorInstance.onDidChangeModelContent(() => {
        // Clear previous timeout
        clearTimeout(saveTimeout);

        // Set new timeout to save after 1000ms of no typing
        saveTimeout = setTimeout(() => {
          this.saveContent();
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

  async loadContent() {
    try {
      return await Excel.run(async (context) => {
        const settings = context.workbook.settings;
        const mainPyContent = settings.getItem("main.py");
        mainPyContent.load("value");
        await context.sync();
        return mainPyContent.value;
      });
    } catch (error) {
      console.log("Error loading content:", error);
      return null;
    }
  },

  async saveContent() {
    const content = editorInstance.getValue();
    await Excel.run(async (context) => {
      const settings = context.workbook.settings;
      settings.add("main.py", content);
      await context.sync();
      console.log("main.py stored");
    });
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
