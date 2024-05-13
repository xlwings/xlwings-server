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
      // "Book1" is for an unsaved book, for saved books include the ext: "Book1.xlsx"
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
