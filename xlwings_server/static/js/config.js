// Config
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#embedding_data_in_html
const configElement = document.getElementById("config");
export const config = configElement
  ? JSON.parse(configElement.textContent)
  : null;
// Bridge for classic scripts (custom-functions-code.js, auth.js) and user code
globalThis.config = config;
