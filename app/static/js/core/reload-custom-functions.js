async function reloadCustomFunctions(meta = null, code = null) {
  // Unofficial API: https://github.com/OfficeDev/office-js/issues/3486
  // This causes issues when opening a workbook in a running instance of Excel. If
  // Excel is completely closed, it does load the add-in, but not if it is already
  // running.
  // Custom functions will show #NAME? until the task pane is opened
  // manually. That's why this is only loaded in "dev" environment. While
  // await Office.addin.setStartupBehavior(Office.StartupBehavior.load); would solve
  // the issue, it would make every workbook, which is opened while the add-in is
  // installed, look for the add-in when reopened.
  await Office.onReady();
  let jsonMetadataString;
  let functionCode;

  if (Office.context.requirements.isSetSupported("CustomFunctions", "1.6")) {
    try {
      if (meta && code) {
        jsonMetadataString = meta;
        functionCode = code;
      } else {
        const [metadataResponse, codeResponse] = await Promise.all([
          fetch(`${config.appPath}/xlwings/custom-functions-meta.json`),
          fetch(`${config.appPath}/xlwings/custom-functions-code.js`),
        ]);

        if (!metadataResponse.ok || !codeResponse.ok) {
          throw new Error("Failed to fetch custom functions data");
        }

        jsonMetadataString = await metadataResponse.text();
        functionCode = await codeResponse.text();
      }

      await Excel.CustomFunctionManager.register(
        jsonMetadataString,
        functionCode,
      );
      // console.log(jsonMetadataString)
      // console.log(functionCode)
      console.log("Successfully reloaded custom functions!");
    } catch (error) {
      console.error("Error reloading custom functions:", error);
    }
  } else {
    try {
      await Excel.run(async (context) => {
        Excel.CustomFunctionManager.newObject(context).register(
          jsonMetadataString,
          functionCode,
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

if (!config.isOfficialLiteAddin) {
  (async () => {
    const maxRetries = 5;
    const delay = 100;
    await retryReloadCustomFunctions(maxRetries, delay);
  })();
}
