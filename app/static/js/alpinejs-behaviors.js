document.addEventListener("alpine:init", () => {
  Alpine.data("bookName", () => {
    return {
      getName: async function () {
        await Office.onReady(); // TODO: move to xlwings.js
        return await xlwings.getActiveBookName();
      },
    };
  });
});
