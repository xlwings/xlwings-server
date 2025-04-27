Office.onReady(async (info) => {
  let cellsToScripts;
  try {
    const url =
      window.location.origin +
      config.appPath +
      "/xlwings/custom-scripts-meta.json";
    const response = await axios.get(url);
    cellsToScripts = response.data;
  } catch (error) {
    console.error("Error fetching custom scripts metadata:", error);
  }
  // onReady is called every time a workbook opens
  for (const scriptMeta of cellsToScripts) {
    // For every script with a target_cell arg, register the onSelectionChanged event
    if (scriptMeta.target_cell) {
      await registerCellToButton(
        scriptMeta.target_cell,
        scriptMeta.function_name,
        scriptMeta.config,
      );
    }
  }
});

async function registerCellToButton(hyperlinkCellRef, scriptName, xwConfig) {
  // hyperlinkCellRef is in the form [ShapeName]Sheet1!A1, where [ShapeName] is optional
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
              config.appPath +
              `/xlwings/custom-scripts-call/${scriptName}`,
            { ...xwConfig, auth: token, scriptName: scriptName },
          );
        } finally {
          sheet.getRange(selectedRangeAddress).getOffsetRange(1, 0).select();
          await context.sync();
        }
      }
    });
  });
}
