// Sample 1: Button on Task pane
// Use runPython with the desired endpoint of your web app
let helloButton = document.querySelector("[data-js-hello]");
helloButton.addEventListener("click", async function (event) {
  let token = await globalThis.getAuth();
  xlwings.runPython(window.location.origin + "/hello", { auth: token });
});

// Sample 2: Button on Ribbon
// Needs event.completed() and Office.actions.associate
// "hello-ribbon" is the identifier in manifest.xml
async function helloRibbon(event) {
  let token = await globalThis.getAuth();
  xlwings.runPython(window.location.origin + "/hello", { auth: token });
  event.completed();
}
Office.actions.associate("hello-ribbon", helloRibbon);
