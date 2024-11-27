// Button on Ribbon
// Needs event.completed() and Office.actions.associate
// "hello-ribbon" is the identifier in manifest.xml
async function helloRibbon(event) {
  let token = await globalThis.getAuth();
  let scriptName = "hello_world";
  await xlwings.runPython(
    window.location.origin +
      config.appPath +
      `/xlwings/custom-scripts-call/${scriptName}`,
    { auth: token, scriptName: scriptName },
  );
  event.completed();
}
Office.actions.associate("hello-ribbon", helloRibbon);
