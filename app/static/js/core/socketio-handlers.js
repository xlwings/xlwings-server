// Socket.io
try {
  globalThis.socket = io({
    transports: ["websocket", "polling"],
    path: `${config.appPath}/socket.io/`,
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
  let token = await globalThis.getAuth();
  xlwings.runPython(
    window.location.origin +
      config.appPath +
      "/xlwings/custom-scripts-call/" +
      data.script_name,
    { ...data.config, auth: token },
  );
});
