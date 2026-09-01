import { config } from "../config.js";
import { xlAlert } from "../alerts/parent.js";
import { getAccessToken } from "../entraid.js";
export { getAccessToken };
import {
  getActiveBookName,
  printSupportedApiVersions,
  getCultureInfoName,
  getDateFormat,
  showGlobalError,
  showGlobalStatus,
  hideGlobalError,
  hideGlobalStatus,
  request,
} from "../utils.js";
export { getActiveBookName, getCultureInfoName, getDateFormat };
import { pyodideReadyPromise, startPyodide } from "../wasm.js";
import { registerSheetButtons } from "./sheet-buttons.js";
import {
  eagerValueRangeAddress,
  loadValuesOnlyUsedRange,
  loadWorksheetNotes,
  mergeCellsState,
  normalizeFillColor,
  rangeMetadata,
  rangeReadKeys,
  rangeReadProperties,
  unqualifiedAddress,
} from "./workbook-metadata.js";
import { dispatchActions } from "./action-dispatch.js";
import { getActionSheet } from "./action-targets.js";
import {
  createSetColumnWidth,
  createSetFormula,
  createSetFormulaArray,
} from "./range-action-callbacks.js";
import { unsupportedRangeExpansion } from "./range-expansion.js";
import { createAddTable } from "./table-action-callbacks.js";
import { createAddChart } from "./chart-action-callbacks.js";

// Prints the supported API versions into the Console
printSupportedApiVersions();

// Namespace
const xlwings = {
  runPython,
  getAccessToken,
  getActiveBookName,
  getBookData,
  runActions,
  pyodideReadyPromise,
  startPyodide,
  getCultureInfoName,
  getDateFormat,
  init,
  registerSheetButtons,
  showGlobalError,
  hideGlobalError,
  showGlobalStatus,
  hideGlobalStatus,
  registerCallback,
  getRangeData,
  getRangeValues,
  getShapeData,
  getChartImage,
  getNoteText,
  getExpandedAddress,
  getActiveSheetIndex,
  getSelection,
};
globalThis.xlwings = xlwings;

// Hook up buttons with the click event upon loading xlwings.js
document.addEventListener("DOMContentLoaded", init);

export async function init() {
  await xlwings.pyodideReadyPromise;
  // Handle unsupported browsers (IE/Edge Legacy)
  if (
    navigator.userAgent.indexOf("Trident") !== -1 ||
    navigator.userAgent.indexOf("Edge") !== -1
  ) {
    showGlobalError(
      "Error: This add-in will not run in your version of Office. Please upgrade " +
        "either to perpetual Office 2021 (or later) or to a Microsoft 365 account.",
    );
    return;
  }
  // Scripts meta
  let scriptsMeta = [];
  if (config.onWasm && !config.isOfficialLiteAddin) {
    scriptsMeta = globalThis.wasmCustomScriptsMeta();
  } else if (!config.isOfficialLiteAddin) {
    const metaUrl =
      window.location.origin +
      config.appPath +
      "/xlwings/custom-scripts-meta.json";
    try {
      const response = await request.get(metaUrl);
      scriptsMeta = response.data;
    } catch (error) {
      console.error("Error fetching script metadata:", error);
    }
  }

  // xw-click registration
  const elements = document.querySelectorAll("[xw-click]");
  elements.forEach((element) => {
    // Prevent duplicate initialization when loading partials via htmx
    if (element.hasAttribute("xw-click-initialized")) return;
    element.setAttribute("xw-click-initialized", "true");
    element.addEventListener("click", async (event) => {
      // Clean up error messages
      const globalErrorAlert = document.querySelector("#global-error-alert");
      if (globalErrorAlert) {
        globalErrorAlert.classList.add("d-none");
      }
      element.setAttribute("disabled", "true");
      // Spinner
      const spinner = document.createElement("span");
      spinner.className = "spinner-border spinner-border-sm text-white";
      spinner.setAttribute("role", "status");
      spinner.setAttribute("aria-hidden", "true");
      element.appendChild(spinner);

      let authResult =
        typeof globalThis.getAuth === "function"
          ? await globalThis.getAuth()
          : { token: "", provider: "" };
      let scriptName = element.getAttribute("xw-click");

      // Config
      let xwConfig = element.getAttribute("xw-config")
        ? JSON.parse(element.getAttribute("xw-config"))
        : {};
      // Find the script config that matches the current scriptName
      const matchingMeta = scriptsMeta.find(
        (meta) => meta.function_name === scriptName,
      );
      if (matchingMeta) {
        // Override xwConfig with the matched meta's config
        xwConfig = {
          ...xwConfig,
          exclude: matchingMeta.exclude || "",
          include: matchingMeta.include || "",
          lazy: matchingMeta.lazy || false,
        };
      }
      // Args
      let xwArgs = [];
      const xwArgsAttr = element.getAttribute("xw-args");
      if (xwArgsAttr) {
        try {
          xwArgs = JSON.parse(xwArgsAttr);
        } catch (e) {
          console.error("Invalid JSON in xw-args attribute:", e);
          element.removeChild(spinner);
          element.removeAttribute("disabled");
          return;
        }
        if (!Array.isArray(xwArgs)) {
          console.error("xw-args must be a JSON array, got:", typeof xwArgs);
          element.removeChild(spinner);
          element.removeAttribute("disabled");
          return;
        }
      }
      // Call runPython and restore button default state
      await runPython({
        ...xwConfig,
        scriptName: scriptName,
        auth: authResult.token,
        headers: { "Auth-Provider": authResult.provider },
        errorDisplayMode: "taskpane",
        args: xwArgs,
      });
      element.removeChild(spinner);
      element.removeAttribute("disabled");
    });
  });
  // Handle sheet buttons
  await registerSheetButtons(scriptsMeta);
}

const version = config.xlwingsVersion;

globalThis.callbacks = {};
export async function runPython({
  scriptName = "",
  auth = "",
  include = "",
  exclude = "",
  headers = {},
  errorDisplayMode = "alert",
  lazy = false,
  args = [],
} = {}) {
  if (!Array.isArray(args)) {
    throw new Error("runPython: 'args' must be an array");
  }
  await Office.onReady();
  try {
    await Excel.run(async (context) => {
      // console.log(payload);
      let payload = await getBookData(
        {
          auth,
          include,
          exclude,
          headers,
          lazy,
        },
        context,
      );
      if (args.length > 0) {
        payload.args = args;
      }
      let rawData;
      if (config.onWasm) {
        // xlwings Wasm
        await pyodideReadyPromise;
        rawData = await globalThis.wasmCustomScriptsCall(payload, scriptName);
        if (rawData.error) {
          console.error(rawData.details);
          throw new Error(rawData.error);
        }
      } else {
        // xlwings Server
        let url =
          window.location.origin +
          config.appPath +
          `/xlwings/custom-scripts-call/${scriptName}`;
        try {
          const response = await request.post(url, payload, {
            headers: headers,
            timeout: config.requestTimeout * 1000,
          });
          rawData = response.data;
        } catch (error) {
          // TODO: align error handling with xlwings Wasm
          if (error.response) {
            const data = error.response.data;
            throw (
              (data && data.detail) ||
              (data && data.error) ||
              (typeof data === "object" ? JSON.stringify(data) : data) ||
              error.response.statusText ||
              "Unknown server error"
            );
          } else if (error.request) {
            throw "No response received from server";
          } else {
            throw error.message;
          }
        }
      }
      // console.log(rawData);

      // Run Functions
      // Note that Pyodide returns undefined, so use != and == rather than !== and ===
      if (rawData != null) {
        await runActions(rawData, context);
      }
    });
  } catch (error) {
    console.error(error);
    if (errorDisplayMode === "alert") {
      await xlAlert(error, "Error", "ok", "critical", "");
    } else {
      const globalErrorAlert = document.querySelector("#global-error-alert");
      if (globalErrorAlert) {
        globalErrorAlert.classList.remove("d-none");
        globalErrorAlert.querySelector("span").textContent = error;
      }
    }
  }
}

// Helpers
async function getSelectedRangeAddress(context) {
  let selectionAddress = null;
  try {
    let selection = context.workbook.getSelectedRange().load("address");
    await context.sync();
    selectionAddress = unqualifiedAddress(selection);
  } catch (error) {
    // No range is selected (e.g., a shape is selected)
  }
  return selectionAddress;
}

async function getActiveSheetIndex() {
  return await Excel.run(async (context) => {
    const activeSheet = context.workbook.worksheets
      .getActiveWorksheet()
      .load("position");
    await context.sync();
    return activeSheet.position;
  });
}

async function getSelection() {
  return await Excel.run(async (context) => {
    const activeSheet = context.workbook.worksheets
      .getActiveWorksheet()
      .load("position");
    const selectionAddress = await getSelectedRangeAddress(context);
    await context.sync();
    return { sheetIndex: activeSheet.position, address: selectionAddress };
  });
}

function convertDateValues(values, categories) {
  values.forEach((row, ri) => {
    const catRow = categories[ri];
    row.forEach((val, ci) => {
      const cat = catRow[ci].toString();
      if ((cat === "Date" || cat === "Time") && typeof val === "number") {
        values[ri][ci] = new Date(
          Math.round((val - 25569) * 86400 * 1000),
        ).toISOString();
      }
    });
  });
}

async function getBookData(
  { auth = "", include = "", exclude = "", headers = {}, lazy = false } = {},
  context = null,
) {
  // Context
  let bookData;
  if (!context) {
    await Excel.run(async (innerContext) => {
      bookData = await getBookData(
        {
          auth,
          include,
          exclude,
          headers,
          lazy,
        },
        innerContext,
      );
    });
    return bookData;
  }

  // workbook
  const workbook = context.workbook;
  workbook.load("name");

  // sheets
  let worksheets = workbook.worksheets;
  worksheets.load("items/name");
  await context.sync();
  let sheets = worksheets.items;

  // Config
  let configSheet = worksheets.getItemOrNullObject("xlwings.conf");
  await context.sync();
  let config = {};
  if (!configSheet.isNullObject) {
    const configRange = configSheet
      .getRange("A1")
      .getSurroundingRegion()
      .load("values");
    await context.sync();
    const configValues = configRange.values;
    configValues.forEach((el) => (config[el[0].toString()] = el[1].toString()));
  }

  if (auth === "") {
    auth = config["AUTH"] || "";
  }

  if (include === "") {
    include = config["INCLUDE"] || "";
  }
  let includeArray = [];
  if (include !== "") {
    includeArray = include.split(",").map((item) => item.trim());
  }

  if (exclude === "") {
    exclude = config["EXCLUDE"] || "";
  }
  let excludeArray = [];
  if (exclude !== "") {
    excludeArray = exclude.split(",").map((item) => item.trim());
  }
  if (includeArray.length > 0 && excludeArray.length > 0) {
    throw "Either use 'include' or 'exclude', but not both!";
  }
  if (includeArray.length > 0) {
    sheets.forEach((sheet) => {
      if (!includeArray.includes(sheet.name)) {
        excludeArray.push(sheet.name);
      }
    });
  }

  if (Object.keys(headers).length === 0) {
    for (const property in config) {
      if (property.toLowerCase().startsWith("header_")) {
        headers[property.substring(7)] = config[property];
      }
    }
  }
  if (!("Authorization" in headers) && auth.length > 0) {
    headers["Authorization"] = auth;
  }

  // Standard headers
  headers["Content-Type"] = "application/json";

  // Request payload
  let payload = {};
  payload["client"] = "Office.js";
  payload["version"] = version;
  let activeSheet = worksheets.getActiveWorksheet().load("position");
  // App-level, so it rides along in the book object rather than per sheet.
  const application = context.workbook.application.load("calculationMode");
  await context.sync();

  // Cell selection address
  const selectionAddress = await getSelectedRangeAddress(context);

  payload["book"] = {
    name: workbook.name,
    active_sheet_index: activeSheet.position,
    selection: selectionAddress,
    calculation: application.calculationMode,
  };

  // Names (book scope)
  let names = [];
  const namedItems = context.workbook.names.load("name, type");
  await context.sync();

  for (const namedItem of namedItems.items) {
    // Currently filtering to named ranges
    if (namedItem.type === "Range") {
      // Names pointing to multiple Ranges return null
      let range = namedItem.getRangeOrNullObject();
      await context.sync();
      names.push({
        name: namedItem.name,
        sheet: range.isNullObject ? null : range.worksheet.load("position"),
        range: range.isNullObject ? null : range.load("address"),
        scope_sheet_name: null,
        scope_sheet_index: null,
        book_scope: true, // workbook.names contains only workbook scope!
      });
    }
  }

  await context.sync();

  let names2 = [];
  names.forEach((namedItem, ix) => {
    names2.push({
      name: namedItem.name,
      sheet_index: namedItem.sheet ? namedItem.sheet.position : null,
      address: unqualifiedAddress(namedItem.range),
      scope_sheet_name: null,
      scope_sheet_index: null,
      book_scope: namedItem.book_scope,
    });
  });

  payload["names"] = names2;

  // Sheets
  payload["sheets"] = [];
  let sheetsLoader = [];
  sheets.forEach((sheet) => {
    sheet.load("name,visibility,names");
    let usedRange;
    if (!excludeArray.includes(sheet.name)) {
      // Values-only is intentional here, even though formatting-only cells
      // extend Excel's/COM's UsedRange. The remote API uses this range to
      // describe and optionally transfer actual workbook data, so including
      // formatting-only cells could make the payload needlessly enormous.
      usedRange = loadValuesOnlyUsedRange(sheet);
    }
    // Metadata like used_range: sent in lazy mode too, so page_setup works on
    // an async book without loading values.
    const printArea = sheet.pageLayout
      .getPrintAreaOrNullObject()
      .load("areas/address");
    // Which cells have a note has to be in the payload, since Range.note is a
    // sync property and can't await a fetch to answer. Only the addresses go,
    // though: a note's text is unbounded, and sending it would put every
    // note's full text in every request. Note.get_text() fetches that.
    const notes = loadWorksheetNotes(
      sheet,
      excludeArray.includes(sheet.name),
      Office.context.requirements.isSetSupported.bind(
        Office.context.requirements,
      ),
    );
    sheetsLoader.push({
      sheet: sheet,
      usedRange: usedRange,
      printArea: printArea,
      notes: notes,
    });
  });

  await context.sync();

  sheetsLoader.forEach((item) => {
    if (item["notes"]) {
      item["noteLocations"] = item["notes"].items.map((note) =>
        note.getLocation().load("address"),
      );
    }
  });

  await context.sync();

  sheetsLoader.forEach((item, ix) => {
    if (!lazy && !excludeArray.includes(item["sheet"].name)) {
      // An empty sheet has no used range; fall back to A1 so the values
      // window stays a 1x1 matrix rather than disappearing.
      sheetsLoader[ix]["range"] = item["sheet"]
        .getRange(eagerValueRangeAddress(item["usedRange"]))
        .load("values, numberFormatCategories");
    }
    // Names (sheet scope) — always load, even in lazy mode
    if (!excludeArray.includes(item["sheet"].name)) {
      sheetsLoader[ix]["names"] = item["sheet"].names.load("name, type");
    }
  });

  await context.sync();

  // Names (sheet scope)
  let namesSheetScope = [];
  for (const item of sheetsLoader) {
    if (!excludeArray.includes(item["sheet"].name)) {
      for (const namedItem of item["names"].items) {
        // Currently filtering to named ranges
        if (namedItem.type === "Range") {
          let range = namedItem.getRangeOrNullObject();
          await context.sync();
          namesSheetScope.push({
            name: namedItem.name,
            sheet: range.isNullObject ? null : range.worksheet.load("position"),
            range: range.isNullObject ? null : range.load("address"),
            scope_sheet: namedItem.worksheet.load("name, position"),
            book_scope: false,
          });
        }
      }
    }
  }

  await context.sync();

  let namesSheetsScope2 = [];
  for (const namedItem of namesSheetScope) {
    namesSheetsScope2.push({
      name: namedItem.name,
      sheet_index: namedItem.sheet ? namedItem.sheet.position : null,
      address: unqualifiedAddress(namedItem.range),
      scope_sheet_name: namedItem.scope_sheet.name,
      scope_sheet_index: namedItem.scope_sheet.position,
      book_scope: namedItem.book_scope,
    });
  }

  // Add sheet scoped names to book scoped names
  payload["names"] = payload["names"].concat(namesSheetsScope2);

  // values
  for (let item of sheetsLoader) {
    let sheet = item["sheet"]; // TODO: replace item["sheet"] with sheet
    let values;
    if (lazy || excludeArray.includes(item["sheet"].name)) {
      values = [[]];
    } else {
      values = item["range"].values;
      if (Office.context.requirements.isSetSupported("ExcelApi", "1.12")) {
        // numberFormatCategories requires Excel 2021/365
        // i.e., dates aren't transformed to Python's datetime in Excel <=2019

        convertDateValues(values, item["range"].numberFormatCategories);
      }
    }
    // Tables
    let tablesArray = [];
    if (!excludeArray.includes(item["sheet"].name)) {
      const tables = sheet.tables.load([
        "name",
        "showHeaders",
        "dataBodyRange",
        "showTotals",
        "style",
        "showFilterButton",
        "highlightFirstColumn",
        "highlightLastColumn",
        "showBandedRows",
        "showBandedColumns",
      ]);
      await context.sync();
      let tablesLoader = [];
      for (let table of sheet.tables.items) {
        tablesLoader.push({
          name: table.name,
          showHeaders: table.showHeaders,
          showTotals: table.showTotals,
          style: table.style,
          showFilterButton: table.showFilterButton,
          highlightFirstColumn: table.highlightFirstColumn,
          highlightLastColumn: table.highlightLastColumn,
          showBandedRows: table.showBandedRows,
          showBandedColumns: table.showBandedColumns,
          range: table.getRange().load("address, rowCount, columnCount"),
          dataBodyRange: table.getDataBodyRange().load("address"),
          headerRowRange: table.showHeaders
            ? table.getHeaderRowRange().load("address")
            : null,
          totalRowRange: table.showTotals
            ? table.getTotalRowRange().load("address")
            : null,
        });
      }
      await context.sync();
      for (let table of tablesLoader) {
        const tableRange = rangeMetadata(table.range);
        tablesArray.push({
          name: table.name,
          range_address: tableRange.address,
          row_count: tableRange.row_count,
          column_count: tableRange.column_count,
          header_row_range_address: table.showHeaders
            ? unqualifiedAddress(table.headerRowRange)
            : null,
          data_body_range_address: unqualifiedAddress(table.dataBodyRange),
          total_row_range_address: table.showTotals
            ? unqualifiedAddress(table.totalRowRange)
            : null,
          show_headers: table.showHeaders,
          show_totals: table.showTotals,
          table_style: table.style,
          show_autofilter: table.showFilterButton,
          show_table_style_first_column: table.highlightFirstColumn,
          show_table_style_last_column: table.highlightLastColumn,
          show_table_style_row_stripes: table.showBandedRows,
          show_table_style_column_stripes: table.showBandedColumns,
        });
      }
    }

    // Charts
    let chartsArray = [];
    if (!excludeArray.includes(item["sheet"].name)) {
      const charts = sheet.charts.load([
        "name",
        "chartType",
        "left",
        "top",
        "width",
        "height",
      ]);
      await context.sync();
      for (let chart of charts.items) {
        chartsArray.push({
          name: chart.name,
          chart_type: chart.chartType,
          left: chart.left,
          top: chart.top,
          width: chart.width,
          height: chart.height,
        });
      }
    }

    // Pictures and shapes: one load covers both, since a picture is a shape
    // whose type is Image.
    let picturesArray = [];
    let shapesArray = [];
    if (!excludeArray.includes(item["sheet"].name)) {
      const shapes = sheet.shapes.load([
        "name",
        "width",
        "height",
        "type",
        "left",
        "top",
        "lockAspectRatio",
      ]);
      await context.sync();
      for (let shape of sheet.shapes.items) {
        if (shape.type == Excel.ShapeType.image) {
          picturesArray.push({
            name: shape.name,
            height: shape.height,
            width: shape.width,
            left: shape.left,
            top: shape.top,
            lock_aspect_ratio: shape.lockAspectRatio,
          });
        }
        shapesArray.push({
          name: shape.name,
          type: shape.type,
          height: shape.height,
          width: shape.width,
          left: shape.left,
          top: shape.top,
        });
      }
    }

    const usedRange = rangeMetadata(item["usedRange"]);
    payload["sheets"].push({
      name: item["sheet"].name,
      visibility: item["sheet"].visibility,
      print_area: printAreaAddress(item["printArea"]),
      notes: notesArray(item),
      used_range_address: usedRange.address,
      used_range_row_count: usedRange.row_count,
      used_range_column_count: usedRange.column_count,
      values: values,
      pictures: picturesArray,
      shapes: shapesArray,
      charts: chartsArray,
      tables: tablesArray,
    });
  }
  return payload;
}

// The print area is a RangeAreas: one or more rectangles, or a null object
// when the sheet has none. xlwings' print_area is a single address string,
// with the areas comma-separated as Excel writes them.
function printAreaAddress(printArea) {
  if (!printArea || printArea.isNullObject) return null;
  const addresses = printArea.areas.items.map((area) =>
    unqualifiedAddress(area),
  );
  return addresses.length > 0 ? addresses.join(",") : null;
}

// Keys a shape read can request. Like the range read keys, this keeps the
// payload sent with every request small: shape text is unbounded, so it's
// fetched on demand rather than shipped for every shape in the workbook.
const SHAPE_READ_KEYS = ["text", "characters_text", "font"];

// A shape's text range, optionally narrowed to a character slice. start/length
// are what Characters carries; null means the whole range.
function shapeTextRange(shape, start, length) {
  const textRange = shape.textFrame.textRange;
  if (start == null) return textRange;
  return length == null
    ? textRange.getSubstring(start)
    : textRange.getSubstring(start, length);
}

async function getShapeData(sheetName, shapeIndex, keys = ["text"], options) {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error(`Unsupported shape read mode: ${JSON.stringify(keys)}`);
  }
  for (const key of keys) {
    if (!SHAPE_READ_KEYS.includes(key)) {
      throw new Error(`Unsupported shape read key: ${key}`);
    }
  }
  return await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const shapes = sheet.shapes.load("items");
    await context.sync();
    const shape = shapes.items[shapeIndex];
    if (!shape) {
      throw new Error(`No shape at index ${shapeIndex} on sheet ${sheetName}`);
    }
    const start = options ? options.start : null;
    const length = options ? options.length : null;
    const result = {};
    // hasText first: reading textRange.text on a shape without text throws,
    // and the desktop engines report None in that case.
    shape.textFrame.load("hasText");
    await context.sync();
    const hasText = shape.textFrame.hasText;
    if (keys.includes("text")) {
      if (hasText) {
        shape.textFrame.textRange.load("text");
        await context.sync();
        result.text = shape.textFrame.textRange.text;
      } else {
        result.text = null;
      }
    }
    if (keys.includes("characters_text")) {
      if (hasText) {
        const textRange = shapeTextRange(shape, start, length);
        textRange.load("text");
        await context.sync();
        result.characters_text = textRange.text;
      } else {
        result.characters_text = null;
      }
    }
    if (keys.includes("font")) {
      if (hasText) {
        const font = shapeTextRange(shape, start, length).font;
        font.load(["bold", "italic", "size", "color", "name"]);
        await context.sync();
        result.font = {
          bold: font.bold,
          italic: font.italic,
          size: font.size,
          color: normalizeFillColor(font.color),
          name: font.name,
        };
      } else {
        result.font = null;
      }
    }
    return result;
  });
}

// Notes are keyed by the address of the cell they're attached to, which is
// how Range.note looks them up.
function notesArray(item) {
  if (!item["notes"] || !item["noteLocations"]) return [];
  return item["notes"].items.map((_note, ix) => ({
    address: unqualifiedAddress(item["noteLocations"][ix]),
  }));
}

// A note's text is fetched when asked for rather than sent with every
// request, since it can be arbitrarily long. The payload carries only which
// cells have a note, which is all Range.note needs.
async function getNoteText(sheetName, cellAddress) {
  return await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const note = sheet.notes.getItemOrNullObject(cellAddress);
    note.load("content");
    await context.sync();
    return note.isNullObject ? null : note.content;
  });
}

// Chart.getImage() returns a base64 PNG, which is data rather than an action,
// so it's fetched on demand like the shape reads.
async function getChartImage(sheetName, chartIndex) {
  return await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const charts = sheet.charts.load("items");
    await context.sync();
    const chart = charts.items[chartIndex];
    if (!chart) {
      throw new Error(`No chart at index ${chartIndex} on sheet ${sheetName}`);
    }
    const image = chart.getImage();
    await context.sync();
    return image.value;
  });
}

// On-demand data fetching for lazy loading
async function getRangeData(sheetName, address, keys = ["values"]) {
  // Validate the public boundary before entering Excel.run() or creating
  // Office proxies so unsupported modes reject as a plain promise error.
  const readKeys = rangeReadKeys(keys);
  const readsValues = readKeys.includes("values");
  const hasDateCategories =
    readsValues &&
    Office.context.requirements.isSetSupported("ExcelApi", "1.12");
  const properties = rangeReadProperties(readKeys, hasDateCategories);
  if (readKeys.includes("merge_cells")) {
    // Needed to tell a fully merged range from a partly merged one.
    properties.push("rowIndex", "columnIndex");
  }
  return await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const range = sheet.getRange(address);
    range.load(properties);
    // These come from method calls rather than loadable properties, so they
    // need their own proxies queued before the sync.
    const surroundingRegion = readKeys.includes("current_region")
      ? range.getSurroundingRegion().load("address")
      : null;
    const mergedAreas =
      readKeys.includes("merge_area") || readKeys.includes("merge_cells")
        ? range
            .getMergedAreasOrNullObject()
            .load(
              "areas/address,areas/rowIndex,areas/columnIndex,areas/rowCount,areas/columnCount",
            )
        : null;
    // getMergedAreasOrNullObject() only reports the part of a merged area that
    // falls *inside* the queried range, so asking a single cell returns that
    // cell rather than the block it belongs to -- where COM's MergeArea gives
    // the whole block. Widen to the surrounding region, which is the
    // contiguous block around the cell and so contains any merged area the
    // cell belongs to. Not the entire row: that has 16k columns, and
    // getMergedAreasOrNullObject() gives up past 512 merged areas.
    const mergeAreaSearch = readKeys.includes("merge_area")
      ? range
          .getSurroundingRegion()
          .getMergedAreasOrNullObject()
          .load("areas/address,areas/columnIndex,areas/columnCount")
      : null;
    if (readKeys.includes("merge_area")) {
      // Needed to pick the area covering this range out of the region.
      range.load("columnIndex");
    }
    const tables = readKeys.includes("table")
      ? range.getTables(false).load("items/name")
      : null;
    await context.sync();
    const metadata = rangeMetadata(range);
    const result = {
      address: metadata.address,
      row_count: metadata.row_count,
      column_count: metadata.column_count,
    };
    for (const key of readKeys) {
      switch (key) {
        case "values": {
          const values = range.values;
          if (hasDateCategories) {
            convertDateValues(values, range.numberFormatCategories);
          }
          result.values = values;
          break;
        }
        case "formulas":
          // Office returns an A1 formula or the underlying raw value for cells
          // without formulas. Keep that representation intact; date conversion
          // applies only to the calculated values matrix above.
          result.formulas = range.formulas;
          break;
        case "formula_array":
          result.formula_array = range.formulaArray;
          break;
        case "number_format": {
          // Office.js reports a per-cell matrix, but xlwings' number_format is
          // a single string (null when the cells don't agree), like COM.
          const formats = (range.numberFormat || []).flat();
          const first = formats.length > 0 ? formats[0] : null;
          result.number_format = formats.every((f) => f === first)
            ? first
            : null;
          break;
        }
        case "color":
          // Office.js may report a named HTML colour ("orange") rather than
          // #RRGGBB; normalize so the Python side only ever sees hex.
          result.color = normalizeFillColor(range.format.fill.color);
          break;
        case "wrap_text":
          result.wrap_text = range.format.wrapText;
          break;
        case "column_width":
          // Raw points, as Office.js reports them; null when the range's
          // columns aren't uniform.
          result.column_width = range.format.columnWidth;
          break;
        case "row_height":
          result.row_height = range.format.rowHeight;
          break;
        case "left":
          result.left = range.left;
          break;
        case "top":
          result.top = range.top;
          break;
        case "width":
          result.width = range.width;
          break;
        case "height":
          result.height = range.height;
          break;
        case "font": {
          const font = range.format.font;
          result.font = {
            bold: font.bold,
            italic: font.italic,
            size: font.size,
            // Office.js may report a named HTML colour here too.
            color: normalizeFillColor(font.color),
            name: font.name,
          };
          break;
        }
        case "hyperlink": {
          // RangeHyperlink carries the target plus display/tip metadata;
          // xlwings' hyperlink is just the address. documentReference is the
          // in-workbook form (e.g. a named range), which has no address.
          const link = range.hyperlink;
          result.hyperlink = link
            ? link.address || link.documentReference || null
            : null;
          break;
        }
        case "current_region":
          result.current_region = unqualifiedAddress(surroundingRegion);
          break;
        case "merge_area": {
          // The region may hold several merged blocks; pick the one covering
          // this range's first column. null when the cell isn't merged, which
          // the Python side turns into the range itself, as COM does.
          const areas =
            !mergeAreaSearch || mergeAreaSearch.isNullObject
              ? []
              : mergeAreaSearch.areas.items;
          const covering = areas.find(
            (area) =>
              area.columnIndex <= range.columnIndex &&
              range.columnIndex < area.columnIndex + area.columnCount,
          );
          result.merge_area = covering ? unqualifiedAddress(covering) : null;
          break;
        }
        case "merge_cells": {
          // Tri-state, like COM's Range.MergeCells: true when the whole range
          // is merged, false when none of it is, and null for a mixed range.
          const areas = mergedAreas.isNullObject ? [] : mergedAreas.areas.items;
          result.merge_cells = mergeCellsState(range, areas);
          break;
        }
        case "table":
          // A range overlaps at most one table in practice; null means none.
          result.table = tables.items.length > 0 ? tables.items[0].name : null;
          break;
      }
    }
    return result;
  });
}

async function getRangeValues(sheetName, address) {
  return (await getRangeData(sheetName, address, ["values"])).values;
}

async function getExpandedAddress(
  sheetName,
  address,
  direction,
  requireSupport = false,
) {
  // getRangeEdge requires ExcelApi 1.13 — fall back to no expansion if unavailable
  if (!Office.context.requirements.isSetSupported("ExcelApi", "1.13")) {
    return unsupportedRangeExpansion(address, requireSupport);
  }

  return await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    const startRange = sheet.getRange(address);
    const usedRange = sheet.getUsedRangeOrNullObject(true);
    startRange.load("rowIndex, columnIndex, rowCount, columnCount");
    usedRange.load("rowIndex, columnIndex, rowCount, columnCount");
    await context.sync();

    if (usedRange.isNullObject) return address;

    const originRow = startRange.rowIndex;
    const originCol = startRange.columnIndex;
    const maxRow = usedRange.rowIndex + usedRange.rowCount - 1;
    const maxCol = usedRange.columnIndex + usedRange.columnCount - 1;

    // Helper: read a single cell's value (equivalent to rng(row, col).raw_value)
    async function cellValue(row, col) {
      if (row > maxRow || col > maxCol || row < 0 || col < 0) return null;
      const cell = sheet.getRangeByIndexes(row, col, 1, 1);
      cell.load("values");
      await context.sync();
      return cell.values[0][0];
    }

    function isEmpty(val) {
      return val === null || val === "" || val === undefined;
    }

    // Helper: equivalent to rng.end("down"/"right") using Office.js getRangeEdge()
    async function rangeEdge(row, col, dir) {
      const cell = sheet.getRangeByIndexes(row, col, 1, 1);
      const edge = cell.getRangeEdge(dir === "down" ? "Down" : "Right");
      edge.load("rowIndex, columnIndex");
      await context.sync();
      return edge;
    }

    if (direction === "table") {
      // TableExpander.expand() from expansion.py
      let bottomRow;
      const cell2down = await cellValue(originRow + 1, originCol);
      if (isEmpty(cell2down)) {
        bottomRow = originRow;
      } else {
        const cell3down = await cellValue(originRow + 2, originCol);
        if (isEmpty(cell3down)) {
          bottomRow = originRow + 1;
        } else {
          const edge = await rangeEdge(originRow + 1, originCol, "down");
          bottomRow = edge.rowIndex;
        }
      }

      let rightCol;
      const cell2right = await cellValue(originRow, originCol + 1);
      if (isEmpty(cell2right)) {
        rightCol = originCol;
      } else {
        const cell3right = await cellValue(originRow, originCol + 2);
        if (isEmpty(cell3right)) {
          rightCol = originCol + 1;
        } else {
          const edge = await rangeEdge(originRow, originCol + 1, "right");
          rightCol = edge.columnIndex;
        }
      }

      const expanded = sheet.getRangeByIndexes(
        originRow,
        originCol,
        bottomRow - originRow + 1,
        rightCol - originCol + 1,
      );
      expanded.load("address");
      await context.sync();
      return expanded.address;
    }

    if (direction === "down" || direction === "vertical" || direction === "d") {
      // VerticalExpander.expand() from expansion.py
      let endRow;
      const cell2down = await cellValue(originRow + 1, originCol);
      if (isEmpty(cell2down)) {
        endRow = originRow;
      } else {
        const cell3down = await cellValue(originRow + 2, originCol);
        if (isEmpty(cell3down)) {
          endRow = originRow + 1;
        } else {
          const edge = await rangeEdge(originRow + 1, originCol, "down");
          endRow = edge.rowIndex;
        }
      }
      const expanded = sheet.getRangeByIndexes(
        originRow,
        originCol,
        endRow - originRow + 1,
        startRange.columnCount,
      );
      expanded.load("address");
      await context.sync();
      return expanded.address;
    }

    if (
      direction === "right" ||
      direction === "horizontal" ||
      direction === "r"
    ) {
      // HorizontalExpander.expand() from expansion.py
      let endCol;
      const cell2right = await cellValue(originRow, originCol + 1);
      if (isEmpty(cell2right)) {
        endCol = originCol;
      } else {
        const cell3right = await cellValue(originRow, originCol + 2);
        if (isEmpty(cell3right)) {
          endCol = originCol + 1;
        } else {
          const edge = await rangeEdge(originRow, originCol + 1, "right");
          endCol = edge.columnIndex;
        }
      }
      const expanded = sheet.getRangeByIndexes(
        originRow,
        originCol,
        startRange.rowCount,
        endCol - originCol + 1,
      );
      expanded.load("address");
      await context.sync();
      return expanded.address;
    }

    return address;
  });
}

async function runActions(rawData, context = null) {
  if (typeof rawData === "string") {
    rawData = JSON.parse(rawData);
  }

  if (!context) {
    return await Excel.run(async (innerContext) => {
      await runActions(rawData, innerContext);
    });
  }

  await dispatchActions(rawData?.actions, context, globalThis.callbacks);
}

async function getRange(context, action) {
  const sheet = await getActionSheet(context, action);
  return sheet.getRangeByIndexes(
    action.start_row,
    action.start_column,
    action.row_count,
    action.column_count,
  );
}

async function getSheet(context, action) {
  return await getActionSheet(context, action);
}

async function getTable(context, action) {
  // Requires action.args[0] to be the table index
  let sheets = context.workbook.worksheets.load("items");
  await context.sync();
  const tables = sheets.items[action.sheet_position].tables.load("items");
  await context.sync();
  return tables.items[parseInt(action.args[0].toString())];
}

async function getShapeByType(context, sheetPosition, shapeIndex, shapeType) {
  let sheets = context.workbook.worksheets.load("items");
  await context.sync();
  const shapes = sheets.items[sheetPosition].shapes.load("items");
  await context.sync();
  const myshapes = shapes.items.filter((shape) => shape.type === shapeType);
  return myshapes[shapeIndex];
}

async function getShapeByIndex(context, sheetPosition, shapeIndex) {
  // Unlike getShapeByType, this indexes the sheet's shapes as-is, matching
  // the order the payload's shapes array is built in.
  const sheets = context.workbook.worksheets.load("items");
  await context.sync();
  const shapes = sheets.items[sheetPosition].shapes.load("items");
  await context.sync();
  return shapes.items[shapeIndex];
}

export function registerCallback(callback) {
  globalThis.callbacks[callback.name] = callback;
}

// Functions map
// Didn't find a way to use registerCallback so that webpack won't strip out these
// functions when optimizing
const setFormula = createSetFormula(getRange);
const setFormulaArray = createSetFormulaArray(
  getRange,
  Office.context.requirements.isSetSupported.bind(Office.context.requirements),
);
const setColumnWidth = createSetColumnWidth(getRange);
const addTable = createAddTable(getSheet);
let funcs = {
  setValues: setValues,
  setFormula: setFormula,
  setFormulaArray: setFormulaArray,
  setColumnWidth: setColumnWidth,
  setRowHeight: setRowHeight,
  setWrapText: setWrapText,
  addSheet: addSheet,
  setSheetName: setSheetName,
  setSheetVisibility: setSheetVisibility,
  setAutofit: setAutofit,
  setSheetAutofit: setSheetAutofit,
  setPrintArea: setPrintArea,
  copySheet: copySheet,
  setRangeColor: setRangeColor,
  activateSheet: activateSheet,
  calculate: calculate,
  save: save,
  setCalculation: setCalculation,
  setScreenUpdating: setScreenUpdating,
  addHyperlink: addHyperlink,
  setNumberFormat: setNumberFormat,
  setPictureName: setPictureName,
  setPictureWidth: setPictureWidth,
  addChart: createAddChart(getSheet, getSelectedRangeAddress),
  setChartName: setChartName,
  setChartType: setChartType,
  setChartSourceData: setChartSourceData,
  setChartPosition: setChartPosition,
  deleteChart: deleteChart,
  setNoteText: setNoteText,
  deleteNote: deleteNote,
  setShapeName: setShapeName,
  setShapeLeft: setShapeLeft,
  setShapeTop: setShapeTop,
  setShapeWidth: setShapeWidth,
  setShapeHeight: setShapeHeight,
  setShapeText: setShapeText,
  setShapeFontProperty: setShapeFontProperty,
  deleteShape: deleteShape,
  scaleShape: scaleShape,
  setPictureLeft: setPictureLeft,
  setPictureTop: setPictureTop,
  setPictureLockAspectRatio: setPictureLockAspectRatio,
  setPictureHeight: setPictureHeight,
  deletePicture: deletePicture,
  addPicture: addPicture,
  updatePicture: updatePicture,
  alert: alert,
  setRangeName: setRangeName,
  namesAdd: namesAdd,
  setNameRefersTo: setNameRefersTo,
  nameDelete: nameDelete,
  runMacro: runMacro,
  rangeDelete: rangeDelete,
  rangeInsert: rangeInsert,
  rangeSelect: rangeSelect,
  rangeClearContents: rangeClearContents,
  rangeClearFormats: rangeClearFormats,
  rangeMerge: rangeMerge,
  rangeUnmerge: rangeUnmerge,
  rangeAutofill: rangeAutofill,
  rangeGroup: rangeGroup,
  rangeUngroup: rangeUngroup,
  rangeClear: rangeClear,
  rangeAdjustIndent: rangeAdjustIndent,
  addTable: addTable,
  setTableName: setTableName,
  resizeTable: resizeTable,
  showAutofilterTable: showAutofilterTable,
  showHeadersTable: showHeadersTable,
  showTotalsTable: showTotalsTable,
  showTableStyleFirstColumn: showTableStyleFirstColumn,
  showTableStyleLastColumn: showTableStyleLastColumn,
  showTableStyleRowStripes: showTableStyleRowStripes,
  showTableStyleColumnStripes: showTableStyleColumnStripes,
  setTableStyle: setTableStyle,
  copyRange: copyRange,
  copyFromRange: copyFromRange,
  sheetDelete: sheetDelete,
  sheetClear: sheetClear,
  sheetClearFormats: sheetClearFormats,
  sheetClearContents: sheetClearContents,
  freezePaneAtRange: freezePaneAtRange,
  freezePaneUnfreeze: freezePaneUnfreeze,
  setFontProperty: setFontProperty,
};

Object.assign(globalThis.callbacks, funcs);

// Callbacks
async function setFontProperty(context, action) {
  let range = await getRange(context, action);
  let property = action.args[0];
  let value = action.args[1];
  if (property === "bold" || property === "italic") value = Boolean(value);
  range.format.font[property] = value;
  await context.sync();
}

async function setValues(context, action) {
  let range = await getRange(context, action);
  range.values = action.values;
  await context.sync();
}

async function setRowHeight(context, action) {
  let range = await getRange(context, action);
  range.format.rowHeight = parseFloat(action.args[0].toString());
  await context.sync();
}

async function setWrapText(context, action) {
  let range = await getRange(context, action);
  range.format.wrapText = Boolean(action.args[0]);
  await context.sync();
}

async function rangeClearContents(context, action) {
  let range = await getRange(context, action);
  range.clear(Excel.ClearApplyTo.contents);
  await context.sync();
}

async function rangeClearFormats(context, action) {
  let range = await getRange(context, action);
  range.clear(Excel.ClearApplyTo.formats);
  await context.sync();
}

async function rangeClear(context, action) {
  let range = await getRange(context, action);
  range.clear(Excel.ClearApplyTo.all);
  await context.sync();
}

async function addSheet(context, action) {
  let sheet;
  if (action.args[1] != null) {
    sheet = context.workbook.worksheets.add(action.args[1].toString());
  } else {
    sheet = context.workbook.worksheets.add();
  }
  sheet.position = parseInt(action.args[0].toString());
}

async function setSheetName(context, action) {
  const sheet = await getSheet(context, action);
  sheet.name = action.args[0].toString();
}

async function setSheetVisibility(context, action) {
  const sheet = await getSheet(context, action);
  sheet.visibility = action.args[0].toString();
}

async function setAutofit(context, action) {
  if (action.args[0] === "columns") {
    let range = await getRange(context, action);
    range.format.autofitColumns();
  } else {
    let range = await getRange(context, action);
    range.format.autofitRows();
  }
}

async function copySheet(context, action) {
  const sheet = await getSheet(context, action);
  const sheets = context.workbook.worksheets;
  sheets.load("items/name");
  await context.sync();
  const relativeTo = sheets.items[parseInt(action.args[1].toString())];
  const copy = sheet.copy(action.args[0].toString(), relativeTo);
  // Excel names the copy itself. Python has already inserted the sheet into
  // its local list under the name it predicted, so rename to match or the two
  // sides disagree about what the sheet is called.
  copy.name = action.args[2].toString();
}

async function setPrintArea(context, action) {
  const sheet = await getSheet(context, action);
  const printArea = action.args[0];
  if (printArea == null) {
    // Office.js has no clearPrintArea; an empty string is what resets it.
    sheet.pageLayout.setPrintArea("");
  } else {
    sheet.pageLayout.setPrintArea(printArea.toString());
  }
}

async function setSheetAutofit(context, action) {
  // Sheet-level, so there are no range coordinates on the action to feed
  // getRange(): getRange() with no address is the whole sheet.
  const sheet = await getSheet(context, action);
  if (action.args[0] === "columns") {
    sheet.getRange().format.autofitColumns();
  } else {
    sheet.getRange().format.autofitRows();
  }
}

async function setRangeColor(context, action) {
  let range = await getRange(context, action);
  if (action.args[0] == null) {
    // color = None removes the background, which is a documented xlwings
    // feature; assigning null here would throw instead.
    range.format.fill.clear();
  } else {
    range.format.fill.color = action.args[0].toString();
  }
  await context.sync();
}

async function calculate(context, action) {
  context.workbook.application.calculate(Excel.CalculationType.full);
}

async function save(context, action) {
  // Saves in place. Office.js has no SaveAs, so Book.save() rejects a path
  // on the Python side rather than silently saving somewhere else.
  context.workbook.save(Excel.SaveBehavior.save);
}

async function setCalculation(context, action) {
  context.workbook.application.calculationMode = action.args[0].toString();
}

async function setScreenUpdating(context, action) {
  // Office.js has no screen updating flag, only a suspend-until-next-sync
  // call, so there's nothing to do when re-enabling: the next sync ends the
  // suspension by itself. Calling it repeatedly makes the window flicker.
  if (!action.args[0]) {
    context.workbook.application.suspendScreenUpdatingUntilNextSync();
  }
}

async function activateSheet(context, action) {
  let worksheets = context.workbook.worksheets;
  worksheets.load("items");
  await context.sync();
  worksheets.items[parseInt(action.args[0].toString())].activate();
}

async function addHyperlink(context, action) {
  let range = await getRange(context, action);
  let hyperlink = {
    textToDisplay: action.args[1].toString(),
    screenTip: action.args[2].toString(),
    address: action.args[0].toString(),
  };
  range.hyperlink = hyperlink;
  await context.sync();
}

async function setNumberFormat(context, action) {
  let range = await getRange(context, action);
  range.numberFormat = [[action.args[0].toString()]];
}

async function setPictureName(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.name = action.args[1].toString();
}

async function setPictureHeight(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.height = Number(action.args[1]);
}

async function getChartByIndex(context, sheetPosition, chartIndex) {
  const sheets = context.workbook.worksheets.load("items");
  await context.sync();
  const charts = sheets.items[sheetPosition].charts.load("items");
  await context.sync();
  return charts.items[chartIndex];
}

async function setChartName(context, action) {
  const chart = await getChartByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  chart.name = action.args[1].toString();
}

async function setChartType(context, action) {
  const chart = await getChartByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  chart.chartType = action.args[1].toString();
}

async function setChartSourceData(context, action) {
  const chart = await getChartByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  const sourceSheet = context.workbook.worksheets.getItem(
    action.args[1].toString(),
  );
  chart.setData(sourceSheet.getRange(action.args[2].toString()));
}

async function setChartPosition(context, action) {
  const chart = await getChartByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  chart[action.args[1].toString()] = Number(action.args[2]);
}

async function deleteChart(context, action) {
  const chart = await getChartByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  chart.delete();
}

async function setNoteText(context, action) {
  const sheet = await getSheet(context, action);
  const address = action.args[0].toString();
  const note = sheet.notes.getItemOrNullObject(address);
  await context.sync();
  if (note.isNullObject) {
    // The public API says the note must already exist, and the desktop
    // engines fail here too rather than creating one.
    throw new Error(`There's no note on ${address} to set the text of.`);
  }
  note.content = action.args[1].toString();
}

async function deleteNote(context, action) {
  const sheet = await getSheet(context, action);
  const note = sheet.notes.getItemOrNullObject(action.args[0].toString());
  await context.sync();
  if (!note.isNullObject) {
    note.delete();
  }
}

async function setShapeName(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.name = action.args[1].toString();
}

async function setShapeLeft(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.left = Number(action.args[1]);
}

async function setShapeTop(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.top = Number(action.args[1]);
}

async function setShapeWidth(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.width = Number(action.args[1]);
}

async function setShapeHeight(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.height = Number(action.args[1]);
}

async function setShapeFontProperty(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  const start = action.args[1];
  const length = action.args[2];
  const font = shapeTextRange(
    shape,
    start == null ? null : Number(start),
    length == null ? null : Number(length),
  ).font;
  font[action.args[3].toString()] = action.args[4];
}

async function setShapeText(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.textFrame.textRange.text = action.args[1].toString();
}

async function deleteShape(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  shape.delete();
}

async function scaleShape(context, action) {
  const shape = await getShapeByIndex(
    context,
    action.sheet_position,
    Number(action.args[0]),
  );
  const factor = Number(action.args[1]);
  const scaleType = action.args[2].toString();
  const scaleFrom = action.args[3].toString();
  if (action.args[4] === "height") {
    shape.scaleHeight(factor, scaleType, scaleFrom);
  } else {
    shape.scaleWidth(factor, scaleType, scaleFrom);
  }
}

async function setPictureLeft(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.left = Number(action.args[1]);
}

async function setPictureTop(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.top = Number(action.args[1]);
}

async function setPictureLockAspectRatio(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.lockAspectRatio = Boolean(action.args[1]);
}

async function setPictureWidth(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.width = Number(action.args[1]);
}

async function deletePicture(context, action) {
  const myshape = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[0]),
    Excel.ShapeType.image,
  );
  myshape.delete();
}

async function addPicture(context, action) {
  const selectedAddress = await getSelectedRangeAddress(context);

  const imageBase64 = action["args"][0].toString();
  const colIndex = Number(action["args"][1]);
  const rowIndex = Number(action["args"][2]);
  let left = Number(action["args"][3]);
  let top = Number(action["args"][4]);

  const sheet = await getSheet(context, action);
  let anchorCell = sheet
    .getRangeByIndexes(rowIndex, colIndex, 1, 1)
    .load("left, top");
  await context.sync();
  left = Math.max(left, anchorCell.left);
  top = Math.max(top, anchorCell.top);
  const image = sheet.shapes.addImage(imageBase64);
  image.left = left;
  image.top = top;

  if (selectedAddress) {
    context.workbook.worksheets
      .getActiveWorksheet()
      .getRange(selectedAddress)
      .select();
    await context.sync();
  }
}

async function updatePicture(context, action) {
  const selectedAddress = await getSelectedRangeAddress(context);

  const imageBase64 = action["args"][0].toString();
  const sheet = await getSheet(context, action);
  let image = await getShapeByType(
    context,
    action.sheet_position,
    Number(action.args[1]),
    Excel.ShapeType.image,
  );
  image = image.load("name, left, top, height, width");
  await context.sync();
  let imgName = image.name;
  let imgLeft = image.left;
  let imgTop = image.top;
  let imgHeight = image.height;
  let imgWidth = image.width;
  image.delete();

  const newImage = sheet.shapes.addImage(imageBase64);
  newImage.name = imgName;
  newImage.left = imgLeft;
  newImage.top = imgTop;
  newImage.height = imgHeight;
  newImage.width = imgWidth;

  if (selectedAddress) {
    context.workbook.worksheets
      .getActiveWorksheet()
      .getRange(selectedAddress)
      .select();
    await context.sync();
  }
}

async function alert(context, action) {
  let myPrompt = action.args[0].toString();
  let myTitle = action.args[1].toString();
  let myButtons = action.args[2].toString();
  let myMode = action.args[3].toString();
  let myCallback = action.args[4].toString();
  xlAlert(myPrompt, myTitle, myButtons, myMode, myCallback);
}

async function setRangeName(context, action) {
  let range = await getRange(context, action);
  context.workbook.names.add(action.args[0].toString(), range);
}

async function namesAdd(context, action) {
  let name = action.args[0].toString();
  let refersTo = action.args[1].toString();
  if (action.sheet_position == null) {
    context.workbook.names.add(name, refersTo);
  } else {
    const sheet = await getSheet(context, action);
    sheet.names.add(name, refersTo);
  }
}

async function nameDelete(context, action) {
  let name = action.args[2].toString();
  let book_scope = Boolean(action.args[4]);
  let scope_sheet_index = Number(action.args[5]);
  if (book_scope === true) {
    context.workbook.names.getItem(name).delete();
  } else {
    let sheets = context.workbook.worksheets.load("items");
    await context.sync();
    sheets.items[scope_sheet_index].names.getItem(name).delete();
  }
}

async function setNameRefersTo(context, action) {
  const name = action.args[0].toString();
  const bookScope = Boolean(action.args[1]);
  const scopeSheetIndex = Number(action.args[2]);
  const refersTo = action.args[3].toString();
  // NamedItem.formula is the writable side of refers_to; NamedItem.name is
  // read-only, which is why Name.name raises on the Python side.
  if (bookScope === true) {
    context.workbook.names.getItem(name).formula = refersTo;
  } else {
    const sheets = context.workbook.worksheets.load("items");
    await context.sync();
    sheets.items[scopeSheetIndex].names.getItem(name).formula = refersTo;
  }
}

async function runMacro(context, action) {
  await globalThis.callbacks[action.args[0].toString()](
    context,
    ...action.args.slice(1),
  );
}

async function rangeDelete(context, action) {
  let range = await getRange(context, action);
  let shift = action.args[0].toString();
  if (shift === "up") {
    range.delete(Excel.DeleteShiftDirection.up);
  } else if (shift === "left") {
    range.delete(Excel.DeleteShiftDirection.left);
  }
}

async function rangeInsert(context, action) {
  let range = await getRange(context, action);
  let shift = action.args[0].toString();
  if (shift === "down") {
    range.insert(Excel.InsertShiftDirection.down);
  } else if (shift === "right") {
    range.insert(Excel.InsertShiftDirection.right);
  }
}

async function rangeSelect(context, action) {
  let range = await getRange(context, action);
  range.select();
}

async function setTableName(context, action) {
  const mytable = await getTable(context, action);
  mytable.name = action.args[1].toString();
}

async function resizeTable(context, action) {
  const mytable = await getTable(context, action);
  mytable.resize(action.args[1].toString());
}

async function showAutofilterTable(context, action) {
  const mytable = await getTable(context, action);
  mytable.showFilterButton = Boolean(action.args[1]);
}

async function showHeadersTable(context, action) {
  const mytable = await getTable(context, action);
  mytable.showHeaders = Boolean(action.args[1]);
}

async function showTotalsTable(context, action) {
  const mytable = await getTable(context, action);
  mytable.showTotals = Boolean(action.args[1]);
}

async function setTableStyle(context, action) {
  const mytable = await getTable(context, action);
  mytable.style = action.args[1].toString();
}

async function showTableStyleFirstColumn(context, action) {
  const mytable = await getTable(context, action);
  mytable.highlightFirstColumn = Boolean(action.args[1]);
}

async function showTableStyleLastColumn(context, action) {
  const mytable = await getTable(context, action);
  mytable.highlightLastColumn = Boolean(action.args[1]);
}

async function showTableStyleRowStripes(context, action) {
  const mytable = await getTable(context, action);
  mytable.showBandedRows = Boolean(action.args[1]);
}

async function showTableStyleColumnStripes(context, action) {
  const mytable = await getTable(context, action);
  mytable.showBandedColumns = Boolean(action.args[1]);
}

async function copyRange(context, action) {
  const destination = context.workbook.worksheets.items[
    parseInt(action.args[0].toString())
  ].getRange(action.args[1].toString());
  destination.copyFrom(await getRange(context, action));
}

async function copyFromRange(context, action) {
  const myRange = await getRange(context, action);
  const sourceRange = context.workbook.worksheets.items[
    parseInt(action.args[0].toString())
  ].getRange(action.args[1].toString());
  const copyType = action.args[2];
  const skipBlanks = Boolean(action.args[3]);
  const transpose = Boolean(action.args[4]);
  myRange.copyFrom(sourceRange, copyType, skipBlanks, transpose);
}

async function sheetDelete(context, action) {
  const sheet = await getSheet(context, action);
  sheet.delete();
}

async function sheetClear(context, action) {
  const sheet = await getSheet(context, action);
  sheet.getRanges().clear(Excel.ClearApplyTo.all);
}

async function sheetClearFormats(context, action) {
  const sheet = await getSheet(context, action);
  sheet.getRanges().clear(Excel.ClearApplyTo.formats);
}

async function sheetClearContents(context, action) {
  const sheet = await getSheet(context, action);
  sheet.getRanges().clear(Excel.ClearApplyTo.contents);
}

async function rangeMerge(context, action) {
  let range = await getRange(context, action);
  range.merge(Boolean(action.args[0]));
  await context.sync();
}

async function rangeAutofill(context, action) {
  let range = await getRange(context, action);
  const sheet = await getSheet(context, action);
  const destination = sheet.getRange(action.args[0].toString());
  range.autoFill(destination, action.args[1].toString());
  await context.sync();
}

async function rangeUnmerge(context, action) {
  let range = await getRange(context, action);
  range.unmerge();
  await context.sync();
}

async function rangeGroup(context, action) {
  let myrange = await getRange(context, action);
  if (action.args[0].toString() == "columns") {
    myrange.group(Excel.GroupOption.byColumns);
  } else {
    myrange.group(Excel.GroupOption.byRows);
  }
}

async function rangeUngroup(context, action) {
  let myrange = await getRange(context, action);
  if (action.args[0].toString() == "columns") {
    myrange.ungroup(Excel.GroupOption.byColumns);
  } else {
    myrange.ungroup(Excel.GroupOption.byRows);
  }
}

async function freezePaneAtRange(context, action) {
  let sheet = await getSheet(context, action);
  let range = sheet.getRange(action.args[0].toString());
  sheet.freezePanes.freezeAt(range);
}

async function freezePaneUnfreeze(context, action) {
  let sheet = await getSheet(context, action);
  sheet.freezePanes.unfreeze();
}

async function rangeAdjustIndent(context, action) {
  let range = await getRange(context, action);
  range.format.adjustIndent(parseInt(action.args[0].toString()));
}
