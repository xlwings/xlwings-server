// Button on Ribbon
// Needs event.completed() and Office.actions.associate
// "hello-ribbon" is the identifier in manifest.xml
async function helloRibbon(event) {
  let scriptName = "hello_world";
  let authResult =
    typeof globalThis.getAuth === "function"
      ? await globalThis.getAuth()
      : { token: "", provider: "" };
  await xlwings.runPython({
    auth: authResult.token,
    scriptName: scriptName,
    headers: { "Auth-Provider": authResult.provider },
  });
  event.completed();
}
Office.actions.associate("hello-ribbon", helloRibbon);
