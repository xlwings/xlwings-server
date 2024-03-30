const data = {
  bookName: {
    getName: async function () {
      await Office.onReady(); // TODO: move to xlwings.js
      return await xlwings.getActiveBookName();
    },
  },
};

// Alpine.data boilerplate
document.addEventListener("alpine:init", () => {
  for (let name in data) {
    Alpine.data(name, () => data[name]);
  }
});
