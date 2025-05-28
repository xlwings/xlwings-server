import { showGlobalStatus, hideGlobalStatus } from "./utils.js";

const registeredHandlers = {};

export async function registerSheetButtons(scriptsMeta) {
  await Office.onReady();
  await removeAllEventHandlers();
  for (const meta of scriptsMeta) {
    // Support both legacy target_cell and button
    const buttonRef = meta?.button || meta?.target_cell || null;
    if (buttonRef) {
      await registerSheetButton(buttonRef, meta);
    }
  }
}

async function registerSheetButton(buttonRef, meta) {
  // buttonRef is in the form [ShapeName]Sheet1!A1, where [ShapeName] is optional
  await Excel.run(async (context) => {
    let shapeName = null;
    let sheetName, cellRef;

    // Check for optional [] part
    const match = buttonRef.match(/^\[(.*?)\](.*)$/);
    if (match) {
      shapeName = match[1];
      [sheetName, cellRef] = match[2].split("!");
    } else {
      [sheetName, cellRef] = buttonRef.split("!");
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
    let scriptName = meta.function_name;
    const handlerKey = `${buttonRef}_${scriptName}`;

    // Register event handler and store the result
    const eventResult = sheet.onSelectionChanged.add(async function (event) {
      let selectedRangeAddress = event.address;
      if (selectedRangeAddress === cellRef && !sheet.isNullObject) {
        const startTime = Date.now();
        try {
          let authResult =
            typeof globalThis.getAuth === "function"
              ? await globalThis.getAuth()
              : { token: "", provider: "" };
          if (meta?.show_taskpane) {
            await Office.addin.showAsTaskpane();
          }
          showGlobalStatus(`Running '${scriptName}' ...`);
          await xlwings.runPython({
            include: meta?.include || "",
            exclude: meta?.exclude || "",
            auth: authResult.token,
            headers: { "Auth-Provider": authResult.provider },
            scriptName: scriptName,
          });
        } finally {
          sheet.getRange(selectedRangeAddress).getOffsetRange(1, 0).select();
          await context.sync();

          // Ensure the status is shown for a minimum time to avoid flickering
          const elapsedTime = Date.now() - startTime;
          const minDisplayTime = 500; // milliseconds

          if (elapsedTime < minDisplayTime) {
            await new Promise((resolve) =>
              setTimeout(resolve, minDisplayTime - elapsedTime),
            );
          }

          hideGlobalStatus();
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
