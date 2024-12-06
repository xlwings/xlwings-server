async function reloadCustomFunctions() {
  // Unofficial API: https://github.com/OfficeDev/office-js/issues/3486
  await Office.onReady();
  let jsonMetadataString, code;

  if (Office.context.requirements.isSetSupported("CustomFunctions", "1.6")) {
    try {
      const [metadataResponse, codeResponse] = await Promise.all([
        fetch(`${config.appPath}/xlwings/custom-functions-meta.json`),
        fetch(`${config.appPath}/xlwings/custom-functions-code.js`),
      ]);

      if (!metadataResponse.ok || !codeResponse.ok) {
        throw new Error("Failed to fetch custom functions data");
      }

      jsonMetadataString = await metadataResponse.text();
      code = await codeResponse.text();

      await Excel.CustomFunctionManager.register(jsonMetadataString, code);
    } catch (error) {
      console.error("Error reloading custom functions:", error);
    }
  } else {
    try {
      await Excel.run(async (context) => {
        Excel.CustomFunctionManager.newObject(context).register(
          jsonMetadataString,
          code,
        );
        await context.sync();
      });
    } catch (error) {
      console.error("Failed to register custom functions:", error);
    }
  }
}

async function retryReloadCustomFunctions(retries, delay) {
  for (let i = 0; i < retries; i++) {
    try {
      await reloadCustomFunctions();
      // console.log(`Reloaded custom functions code at attempt ${i + 1}`);
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

(async () => {
  const maxRetries = 5;
  const delay = 100;
  await retryReloadCustomFunctions(maxRetries, delay);
})();
