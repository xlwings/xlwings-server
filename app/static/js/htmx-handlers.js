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
  } else {
    // Mostly 502/503/504 errors
    globalErrorAlert.querySelector("span").textContent =
      `Error ${errorCode}: Please reload the page!`;
  }
});
