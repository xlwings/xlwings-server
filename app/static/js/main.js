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

// Sample 1: Button on Task pane
// Use runPython with the desired endpoint of your web app
let helloButton = document.querySelector("[data-js-hello]");
if (helloButton) {
  helloButton.addEventListener("click", async function (event) {
    let token = await globalThis.getAuth();
    xlwings.runPython(window.location.origin + "/hello", { auth: token });
  });
}

// Sample 2: Button on Ribbon
// Needs event.completed() and Office.actions.associate
// "hello-ribbon" is the identifier in manifest.xml
async function helloRibbon(event) {
  let token = await globalThis.getAuth();
  xlwings.runPython(window.location.origin + "/hello", { auth: token });
  event.completed();
}
Office.actions.associate("hello-ribbon", helloRibbon);
