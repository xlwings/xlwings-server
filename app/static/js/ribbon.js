// Button on Ribbon
// Needs event.completed() and Office.actions.associate
// "hello-ribbon" is the identifier in manifest.xml
// Make sure to update the ids in createTabConfig to match the ones used in manifest.xml
async function helloRibbon(event) {
  const createTabsConfig = (enabled) => ({
    tabs: [
      {
        id: "MyTab",
        groups: [
          {
            id: "MyCommandsGroup",
            controls: [
              {
                id: "MyFunctionButton",
                enabled: enabled,
              },
            ],
          },
        ],
      },
    ],
  });

  // Disable the button
  await Office.onReady();
  await Office.ribbon.requestUpdate(createTabsConfig(false));

  try {
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
  } finally {
    // Enable the button
    await Office.ribbon.requestUpdate(createTabsConfig(true));
    event.completed();
  }
}
Office.actions.associate("hello-ribbon", helloRibbon);
