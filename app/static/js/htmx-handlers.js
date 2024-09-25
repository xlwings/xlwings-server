// Config
htmx.config.includeIndicatorStyles = false; // required by CSP
htmx.config.historyCacheSize = 0;
htmx.config.allowEval = false;
htmx.config.selfRequestsOnly = true;

// Error handling
htmx.on("htmx:sendError", function (event) {
  // Connection issues
  const globalErrorAlert = document.querySelector("#global-error-alert");
  globalErrorAlert.classList.remove("d-none");
  globalErrorAlert.querySelector("span").textContent =
    "Connection error. Please reload the page!";
});

htmx.on("htmx:responseError", function (event) {
  // Unhandled exceptions from Python partials or nginx.
  // Exceptions with full page reloads are handled with FastAPI exceptions handlers.
  const globalErrorAlert = document.querySelector("#global-error-alert");
  const errorCode = event.detail.xhr.status;
  globalErrorAlert.classList.remove("d-none");
  if (errorCode === 404) {
    globalErrorAlert.querySelector("span").textContent =
      `Error ${errorCode}: Page not found`;
  } else if (errorCode === 500) {
    globalErrorAlert.querySelector("span").textContent = `Error ${errorCode}`;
  } else if (errorCode === 401) {
    globalErrorAlert.querySelector("span").textContent =
      `Error ${errorCode}: Unauthorized`;
  } else if (errorCode === 403) {
    globalErrorAlert.querySelector("span").textContent =
      `Error ${errorCode}: Forbidden`;
  } else {
    // Mostly 502/503/504 errors
    globalErrorAlert.querySelector("span").textContent =
      `Error ${errorCode}: Please reload the page!`;
  }
});

// Task pane authentication (see: https://htmx.org/examples/async-auth/)
let authToken = null;

htmx.on("htmx:confirm", async (event) => {
  // Block the request until the token is returned
  event.preventDefault();
  authToken = await globalThis.getAuth();
  event.detail.issueRequest();
});

htmx.on("htmx:configRequest", (event) => {
  event.detail.headers["Authorization"] = authToken;
});
