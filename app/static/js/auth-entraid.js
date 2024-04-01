globalThis.getAuth = async function () {
  return await xlwings.getAccessToken();
};
