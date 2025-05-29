// Socket.io
try {
  globalThis.socket = io({
    transports: ["websocket", "polling"],
    path: `${config.appPath}/socket.io/`,
    auth: async (callback) => {
      let authResult =
        typeof globalThis.getAuth === "function"
          ? await globalThis.getAuth()
          : { token: "", provider: "" };
      callback({
        token: authResult.token,
        provider: authResult.provider,
      });
    },
  });
} catch (error) {
  console.log("Didn't load socket.io: ", error);
  globalThis.socket = null;
}

globalThis.socket.on("xlwings:trigger-script", async (data) => {
  let authResult =
    typeof globalThis.getAuth === "function"
      ? await globalThis.getAuth()
      : { token: "", provider: "" };
  xlwings.runPython({
    include: data?.include || "",
    exclude: data?.exclude || "",
    auth: authResult.token,
    headers: { "Auth-Provider": authResult.provider },
    scriptName: data.script_name,
  });
});
