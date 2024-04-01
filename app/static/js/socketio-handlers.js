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
  console.error(error);
  globalThis.socket = null;
}
