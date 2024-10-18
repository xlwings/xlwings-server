const alpineComponents = {};

document.addEventListener("alpine:init", () => {
  for (let name in alpineComponents) {
    Alpine.data(name, () => alpineComponents[name]);
  }
});

function registerAlpineComponent(name, obj) {
  alpineComponents[name] = obj;
}
