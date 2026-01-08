globalThis.getAuth = async function () {
  if (config.authProviders.includes("entraid")) {
    const token = await xlwings.getAccessToken();
    return {
      token: token,
      provider: "entraid",
    };
  }
  return {
    token: "",
    provider: "",
  };
};
