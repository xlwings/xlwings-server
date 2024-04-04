const data = {
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
  bookName: {
    getName: async function () {
      return await xlwings.getActiveBookName();
    },
  },
};

// Alpine boilerplate
document.addEventListener("alpine:init", () => {
  for (let name in data) {
    Alpine.data(name, () => data[name]);
  }
});
