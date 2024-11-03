const visibility = {
  open: false,
  label: "Show",

  toggle(event) {
    this.open = !this.open;
    this.label = this.open ? "Hide" : "Show";
  },
};
registerAlpineComponent("visibility", visibility);

const slider = {
  percentage: 50,
  update(event) {
    this.percentage = event.target.value;
  },
};
registerAlpineComponent("slider", slider);

const nameForm = {
  firstName: "",
  lastName: "",
  fullName: "(empty)",
  handleInput(event) {
    this[event.target.name] = event.target.value;
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
