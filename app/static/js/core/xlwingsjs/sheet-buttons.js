const registeredHandlers = {};

export async function registerSheetButtons(scriptsMeta) {
  await Office.onReady();
  await removeAllEventHandlers();
  for (const meta of scriptsMeta) {
    // For every script with a target_cell arg, register the onSelectionChanged event
    if (meta.target_cell) {
      await registerSheetButton(
        meta.target_cell,
        meta.function_name,
        meta.config,
      );
    }
  }
}

async function registerSheetButton(hyperlinkCellRef, scriptName, xwConfig) {
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

    // Create a unique key for this handler
    const handlerKey = `${hyperlinkCellRef}_${scriptName}`;

    // Register event handler and store the result
    const eventResult = sheet.onSelectionChanged.add(async function (event) {
      let selectedRangeAddress = event.address;
      if (selectedRangeAddress === cellRef && !sheet.isNullObject) {
        try {
          let token =
            typeof globalThis.getAuth === "function"
              ? await globalThis.getAuth()
              : "";
          await xlwings.runPython({
            ...xwConfig,
            auth: token,
            scriptName: scriptName,
          });
        } finally {
          sheet.getRange(selectedRangeAddress).getOffsetRange(1, 0).select();
          await context.sync();
        }
      }
    });

    // Store the event result for later removal if needed
    registeredHandlers[handlerKey] = eventResult;

    await context.sync();
  });
}

// Helper function to remove all registered event handlers
async function removeAllEventHandlers() {
  const handlerKeys = Object.keys(registeredHandlers);

  if (handlerKeys.length === 0) {
    return;
  }

  for (const key of handlerKeys) {
    const eventResult = registeredHandlers[key];
    try {
      // Use the stored context to remove the handler
      await Excel.run(eventResult.context, async (context) => {
        eventResult.remove();
        await context.sync();
      });
    } catch (error) {
      console.warn(`Failed to remove handler ${key}:`, error);
    }
  }

  // Clear the registry
  Object.keys(registeredHandlers).forEach(
    (key) => delete registeredHandlers[key],
  );
}
