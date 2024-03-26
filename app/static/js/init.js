Office.onReady(function (info) {
  globalThis.getAuth = async function () {
    // This is required for authentication and must not be deleted
    // To activate Entra ID authentication, replace "" with: await xlwings.getAccessToken()
    return "";
    // return await xlwings.getAccessToken();
  };

  try {
    globalThis.socket = io({
      auth: async (callback) => {
        let token = await globalThis.getAuth();
        callback({
          token: token,
        });
      },
    });
  } catch (error) {
    globalThis.socket = null;
  }
});
