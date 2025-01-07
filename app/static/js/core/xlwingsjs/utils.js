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

// Culture Info Name, e.g., en-DE
let cachedCultureInfoName = null;
export async function getCultureInfoName() {
  if (cachedCultureInfoName) {
    return cachedCultureInfoName;
  }
  if (!Office.context.requirements.isSetSupported("ExcelApi", "1.12")) {
    return null;
  }
  const context = new Excel.RequestContext();
  context.application.cultureInfo.load(["name"]);
  await context.sync();
  cachedCultureInfoName = `${context.application.cultureInfo.name}`;
  return cachedCultureInfoName;
}

// Date format
let cachedDateFormat = null;
export async function getDateFormat() {
  if (cachedDateFormat) {
    return cachedDateFormat;
  }
  if (!Office.context.requirements.isSetSupported("ExcelApi", "1.12")) {
    return null;
  }
  const context = new Excel.RequestContext();
  context.application.cultureInfo.datetimeFormat.load(["shortDatePattern"]);
  await context.sync();
  cachedDateFormat = `${context.application.cultureInfo.datetimeFormat.shortDatePattern}`;
  return cachedDateFormat;
}

export function printSupportedApiVersions() {
  const versions = [...Array(30)].map((_, i) => `1.${i}`);

  async function printBuildInfo() {
    if (Office.context.diagnostics) {
      console.log(`Office Build: ${Office.context.diagnostics.version}`);
      console.log(`Office Platform: ${Office.context.diagnostics.platform}`);
      console.log(
        `Culture Info Name: ${(await getCultureInfoName()) || "N/A"}`,
      );
      console.log(`Local Date Format: ${(await getDateFormat()) || "N/A"}`);
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

  Office.onReady(async () => {
    await printBuildInfo();
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
