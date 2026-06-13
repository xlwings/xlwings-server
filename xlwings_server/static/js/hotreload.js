import { socket } from "./integrations/socketio.js";

if (socket) {
  socket.on("reload", () => {
    location.reload();
  });
}
