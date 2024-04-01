// Button on Task pane
// Use runPython with the desired endpoint of your web app
let helloButton = document.querySelector("[data-js-hello]");
if (helloButton) {
  helloButton.addEventListener("click", async function (event) {
    let token = await globalThis.getAuth();
    xlwings.runPython(window.location.origin + "/hello", { auth: token });
  });
}
