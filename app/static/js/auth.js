// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#embedding_data_in_html
const authData = JSON.parse(document.getElementById("auth").text);

globalThis.getAuth = async function () {
  if (authData.auth === "entraid") {
    return await xlwings.getAccessToken();
  }
  return "";
};
