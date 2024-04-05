// Multiapp
const exampleData = {
  appLoader: {
    init: async function () {
      let bookName = await xlwings.getActiveBookName();
      if (bookName === "Book1") {
        this.url = "/taskpane?app=1";
      } else {
        this.url = "/taskpane?app=2";
      }
      this.$nextTick(() => {
        htmx.process(this.$el);
        this.$dispatch("app:loadTaskpane");
      });
    },
    url: "",
  },
};

// Alpine boilerplate
document.addEventListener("alpine:init", () => {
  for (let name in exampleData) {
    Alpine.data(name, () => exampleData[name]);
  }
});
