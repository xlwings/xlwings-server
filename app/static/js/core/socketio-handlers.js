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
  xlwings.runPython({
    include: data?.include || "",
    exclude: data?.exclude || "",
    auth: token,
    scriptName: data.script_name,
  });
});
