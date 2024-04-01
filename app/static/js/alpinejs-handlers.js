const data = {
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
