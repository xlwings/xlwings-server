// Starts Alpine (CSP build) after all custom JS has registered its components.
//
// Loaded as the LAST module in <head>. The ESM Alpine build does not auto-start
// (unlike the cdn build), so we register the collected components on alpine:init
// and then call start() ourselves -- guaranteeing registration happens before
// Alpine processes the DOM, regardless of how main.js/examples.js are split into
// modules. The component map lives on globalThis (see integrations/alpinejs-csp.js).
//
// The Alpine import is RELATIVE (not url_for) so it resolves under any
// XLWINGS_APP_PATH and stays an external module -- inline scripts would be
// blocked by the strict CSP that this feature exists to support.
import { Alpine } from "../../vendor/@alpinejs/csp/3.15.12/dist/module.esm.min.js";

document.addEventListener("alpine:init", () => {
  const components = globalThis.alpineComponents || {};
  for (const name in components) {
    Alpine.data(name, () => components[name]);
  }
});

globalThis.Alpine = Alpine;
Alpine.start();
