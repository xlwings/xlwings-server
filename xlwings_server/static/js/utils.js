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
      console.log(`User Agent: ${navigator.userAgent}`);
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

export function showGlobalError(message) {
  const alertEl = document.getElementById("global-error-alert");
  const alertMessage = alertEl.querySelector("span");
  alertMessage.textContent = message;
  alertEl.classList.remove("d-none");
}

export function showGlobalStatus(message) {
  const alertEl = document.getElementById("global-status-alert");
  const alertMessage = alertEl.querySelector("span");
  alertMessage.textContent = message;
  alertEl.classList.remove("d-none");
}

export function hideGlobalError() {
  const alertEl = document.getElementById("global-error-alert");
  alertEl.classList.add("d-none");
}

export function hideGlobalStatus() {
  const alertEl = document.getElementById("global-status-alert");
  alertEl.classList.add("d-none");
}

// Minimal HTTP helper backed by XMLHttpRequest.
//
// We can't use fetch() for our requests: on macOS Excel desktop (WKWebView),
// fetch is backed by NSURLSession, whose request timeout defaults to 60s and
// cannot be raised from JS (AbortController can only abort *earlier*). Any call
// running longer than 60s is therefore killed by the platform regardless of our
// configured requestTimeout. XHR's `timeout` property has no such ceiling, so
// long-running runPython/custom-function calls keep working. Also published on
// globalThis (below) so custom-functions/custom-functions-code.js can reuse it:
// that file is a classic, self-contained script that can't import this module.
//
// API: request.get/post(url, [body], opts) resolves to {data, status,
// statusText} on a 2xx response, and otherwise rejects with error.response set
// on HTTP errors or error.request set on network/timeout failures.
function xhrRequest(method, url, { headers = {}, body, timeout } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    for (const [key, value] of Object.entries(headers)) {
      // Skip null/undefined headers (fetch would coerce them to "null").
      if (value != null) xhr.setRequestHeader(key, value);
    }
    if (timeout) xhr.timeout = timeout;

    xhr.onload = () => {
      let data = xhr.responseText;
      const contentType = xhr.getResponseHeader("Content-Type") || "";
      if (contentType.includes("application/json") && data) {
        try {
          data = JSON.parse(data);
        } catch {
          // leave as raw text
        }
      }
      const response = {
        data,
        status: xhr.status,
        statusText: xhr.statusText,
      };
      // Resolve only on 2xx; everything else rejects with .response set.
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(response);
      } else {
        const error = new Error(`Request failed with status ${xhr.status}`);
        error.response = response;
        reject(error);
      }
    };
    // Network failure, timeout, or abort: no HTTP response available.
    xhr.onerror = () => {
      const error = new Error("Network error");
      error.request = xhr;
      reject(error);
    };
    xhr.ontimeout = () => {
      const error = new Error("Request timed out");
      error.request = xhr;
      reject(error);
    };
    xhr.onabort = () => {
      const error = new Error("Request aborted");
      error.request = xhr;
      reject(error);
    };

    xhr.send(body != null ? JSON.stringify(body) : null);
  });
}

export const request = {
  get: (url, opts) => xhrRequest("GET", url, opts),
  post: (url, body, opts) => xhrRequest("POST", url, { ...opts, body }),
};

// Bridge for the custom-functions classic script (see comment above).
globalThis.xwRequest = request;
