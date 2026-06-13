// Socket.io
import { config } from "../config.js";

let socket;
try {
  socket = io({
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
  socket = null;
}
export { socket };
// Bridge for the dynamically served custom-functions-code.js, which can't use imports
globalThis.socket = socket;

if (socket) {
  socket.on("xlwings:trigger-script", async (data) => {
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
}
