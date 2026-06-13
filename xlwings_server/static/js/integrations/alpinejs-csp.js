// CSP-safe Alpine component registry (classic script, loaded early).
//
// In the CSP build, components must be registered via Alpine.data() rather than
// inline x-data expressions. registerAlpineComponent collects them into a map;
// the starter module (integrations/alpinejs-start.js) flushes the map on
// alpine:init and then calls Alpine.start(). Because the ESM Alpine build does
// NOT auto-start (unlike the cdn build), the starter controls the timing, so all
// custom JS (main.js/examples.js) registers before Alpine processes the DOM.
//
// Kept on globalThis (and as a classic script) so user code and CSP-build inline
// scripts can register without importing anything.
globalThis.alpineComponents = {};

globalThis.registerAlpineComponent = function (name, obj) {
  globalThis.alpineComponents[name] = obj;
};
