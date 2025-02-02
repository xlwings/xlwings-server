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

const monacoEditor = {
  editor: null,
  async init() {
    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs",
      },
    });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs/editor/editor.main.css";
    document.head.appendChild(link);

    return new Promise((resolve) => {
      require(["vs/editor/editor.main"], () => {
        this.editor = monaco.editor.create(this.$refs.editorContainer, {
          value: "# Type your code here\n",
          language: "python",
          theme: "vs-light",
          minimap: { enabled: false },
          automaticLayout: true,
        });
        resolve();
      });
    });
  },
};
registerAlpineComponent("monacoEditor", monacoEditor);
