const authData = JSON.parse(document.getElementById("auth").textContent);

globalThis.getAuth = async function () {
  if (authData.auth === "entraid") {
    return await xlwings.getAccessToken();
  }
  return "";
};
