export async function getActiveBookName() {
  try {
    await Office.onReady();
    return await Excel.run(async (context) => {
      const workbook = context.workbook;
      workbook.load("name");
      await context.sync();
      return workbook.name;
    });
  } catch (error) {
    console.error(error);
  }
}

export function printSupportedApiVersions() {
  const versions = [...Array(30)].map((_, i) => `1.${i}`);

  function printBuildInfo() {
    if (Office.context.diagnostics) {
      console.log(`Office Build: ${Office.context.diagnostics.version}`);
      console.log(`Office Platform: ${Office.context.diagnostics.platform}`);
    }
  }

  function printSupportedVersion(apiName) {
    let supportedVersion = null;

    for (const version of versions) {
      if (Office.context.requirements.isSetSupported(apiName, version)) {
        supportedVersion = version;
      } else {
        break;
      }
    }

    if (supportedVersion) {
      console.log(`${apiName}: ${supportedVersion}`);
    } else {
      console.log(`${apiName}: N/A`);
    }
  }

  Office.onReady(() => {
    printBuildInfo();
    const apiNames = [
      "ExcelAPI",
      "SharedRuntime",
      "CustomFunctions",
      "CustomFunctionsRuntime",
      "DialogAPI",
      "RibbonAPI",
    ];

    apiNames.forEach((name) => {
      printSupportedVersion(name);
    });
  });
}
