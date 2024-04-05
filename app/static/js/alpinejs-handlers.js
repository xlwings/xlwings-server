const alpineData = {};

// Alpine boilerplate
document.addEventListener("alpine:init", () => {
  for (let name in alpineData) {
    Alpine.data(name, () => alpineData[name]);
  }
});
