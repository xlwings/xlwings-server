const nameForm = {
  firstName: "",
  lastName: "",
  fullName: "",
  handleInput(event) {
    this[event.target.id] = event.target.value;
    this.fullName = `${this.firstName} ${this.lastName}`;
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
