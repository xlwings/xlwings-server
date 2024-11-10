globalThis.getAuth = async function () {
  if (config.authProviders.includes("entraid")) {
    return await xlwings.getAccessToken();
  }
  return "";
};
