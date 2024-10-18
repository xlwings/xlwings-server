// XLWINGS_APP_PATH setting
const appPathElement = document.getElementById("app-path");
const appPath = appPathElement ? JSON.parse(appPathElement.textContent) : null;

// Socket.io
try {
  globalThis.socket = io({
    path:
      (appPath && appPath.appPath !== "" ? `/${appPath.appPath}` : "") +
      "/socket.io/",
    auth: async (callback) => {
      let token = await globalThis.getAuth();
      callback({
        token: token,
      });
    },
  });
} catch (error) {
  console.log("Didn't load socket.io: ", error);
  globalThis.socket = null;
}

globalThis.socket.on("xlwings:trigger-script", async (data) => {
  const appPathElement = document.getElementById("app-path");
  const appPath = appPathElement
    ? JSON.parse(appPathElement.textContent)
    : null;
  let token = await globalThis.getAuth();
  xlwings.runPython(
    window.location.origin +
      (appPath && appPath.appPath !== "" ? `/${appPath.appPath}` : "") +
      "/xlwings/custom-scripts-call/" +
      data.script_name,
    { ...data.config, auth: token },
  );
});
