const visibility = {
  isOpen: false,
  label: "Show",
  toggle() {
    this.isOpen = !this.isOpen;
    this.label = this.isOpen ? "Hide" : "Show";
  },
};
registerAlpineComponent("visibility", visibility);

const slider = {
  percentage: 50,
  update() {
    this.percentage = this.$el.value;
  },
};
registerAlpineComponent("slider", slider);

const nameForm = {
  firstName: "",
  lastName: "",
  fullName: "(empty)",
  focus() {
    this.$el.focus();
  },
  handleInput() {
    this[this.$el.name] = this.$el.value;
    const fullName = `${this.firstName} ${this.lastName}`;
    this.fullName = !this.firstName && !this.lastName ? "(empty)" : fullName;
  },
};
registerAlpineComponent("nameForm", nameForm);

const appLoader = {
  url: "",
  async init() {
    let bookName = await xlwings.getActiveBookName();
    // Works with both an unsaved book ("Book1") as well as a saved one "Book1.xlsx"
    if (bookName.includes("Book1")) {
      // TODO: fix if app_path is provided
      this.url = "/taskpane?app=1";
    } else {
      this.url = "/taskpane?app=2";
    }
    this.$nextTick(() => {
      htmx.process(this.$el);
      this.$dispatch("app:loadTaskpane");
    });
  },
};
registerAlpineComponent("appLoader", appLoader);

// Must not be reactive, i.e., must not be inside the monacoEditor component
let editorInstance = null;

const monacoEditor = {
  async init() {
    await Office.onReady();
    let savedContent = await this.loadContent();

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
    let code = editorInstance.getValue();
    await xlwings.runPython("", {
      ...{},
      scriptName: "main", // TODO: allow to specify
      auth: "",
      errorDisplayMode: "taskpane",
      moduleString: code,
    });
  },
};
registerAlpineComponent("monacoEditor", monacoEditor);
