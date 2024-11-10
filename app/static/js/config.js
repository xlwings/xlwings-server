// Config
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#embedding_data_in_html
const configElement = document.getElementById("config");
const config = configElement ? JSON.parse(configElement.textContent) : null;
