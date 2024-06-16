// Button on Ribbon
// Needs event.completed() and Office.actions.associate
// "hello-ribbon" is the identifier in manifest.xml
async function helloRibbon(event) {
  let token = await globalThis.getAuth();
  xlwings.runPython(
    window.location.origin + "/xlwings/custom-scripts-call/hello_world",
    { auth: token },
  );
  event.completed();
}
Office.actions.associate("hello-ribbon", helloRibbon);
