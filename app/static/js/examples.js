const exampleData = {
  helloWorld: {
    hello: async function () {
      let token = await globalThis.getAuth();
      xlwings.runPython(window.location.origin + "/hello", { auth: token });
    },
  },
  appLoader: {
    init: async function () {
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
    url: "",
  },
};

// Alpine boilerplate
document.addEventListener("alpine:init", () => {
  for (let name in exampleData) {
    Alpine.data(name, () => exampleData[name]);
  }
});
