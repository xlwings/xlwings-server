// Socket.io
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
  console.log("Didn't load socket.io: ", error);
  globalThis.socket = null;
}
