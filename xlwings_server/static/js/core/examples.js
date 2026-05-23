function alertCallback(arg) {
  let outputContainer = document.getElementById("output-container");
  if (!outputContainer) {
    outputContainer = document.createElement("div");
    outputContainer.id = "output-container";
    document.querySelector(".container-fluid").appendChild(outputContainer);
  }
  outputContainer.textContent = `User clicked: ${arg}`;
}
xlwings.registerCallback(alertCallback);

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
