Office.onReady(async (info) => {
  // onReady is called every time a file opens and registers onSelectionChanged event
  for (const [hyperlinkCellRef, scriptName, config] of cellsToScripts) {
    await registerCellToButton(hyperlinkCellRef, scriptName, config);
  }
});

async function registerCellToButton(hyperlinkCellRef, scriptName, config) {
  // hyperlinkCellRef is in the form [ShapeName]Sheet1!A1, where [ShapeName] is optional
  const appPathElement = document.getElementById("app-path");
  const appPath = appPathElement
    ? JSON.parse(appPathElement.textContent)
    : null;
  await Excel.run(async (context) => {
    let shapeName = null;
    let sheetName, cellRef;

    // Check for optional [] part
    const match = hyperlinkCellRef.match(/^\[(.*?)\](.*)$/);
    if (match) {
      shapeName = match[1];
      [sheetName, cellRef] = match[2].split("!");
    } else {
      [sheetName, cellRef] = hyperlinkCellRef.split("!");
    }

    if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
      sheetName = sheetName.slice(1, -1);
    }
    let sheet = context.workbook.worksheets.getItemOrNullObject(sheetName);
    await context.sync();

    // Check if shape exists
    if (shapeName) {
      let shape = sheet.shapes.getItemOrNullObject(shapeName);
      await context.sync();
      if (shape.isNullObject) {
        return;
      }
    }

    // Register event handler
    sheet.onSelectionChanged.add(async function (event) {
      let selectedRangeAddress = event.address;
      if (selectedRangeAddress === cellRef && !sheet.isNullObject) {
        try {
          let token =
            typeof globalThis.getAuth === "function"
              ? await globalThis.getAuth()
              : "";
          await xlwings.runPython(
            window.location.origin +
              (appPath && appPath.appPath !== "" ? `/${appPath.appPath}` : "") +
              `/xlwings/custom-scripts-call/${scriptName}`,
            { ...config, auth: token },
          );
        } finally {
          sheet.getRange(selectedRangeAddress).getOffsetRange(1, 0).select();
          await context.sync();
        }
      }
    });
  });
}
