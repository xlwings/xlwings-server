Office.onReady(function (info) {
  const socket = globalThis.socket;
  socket.on("reload", () => {
    location.reload();
  });
});
