const authData = JSON.parse(document.getElementById("auth").text);

globalThis.getAuth = async function () {
  if (authData.auth === "entraid") {
    return await xlwings.getAccessToken();
  }
  return "";
};
