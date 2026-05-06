// Office.onReady() can hang indefinitely when Excel restores a task pane
// before the add-in host channel is wired up (typical on Windows after
// closing and reopening Excel). Auto-reload a bounded number of times
// since a single reload usually clears it; fall back to a manual reload
// button so the user has an escape if the auto-retries also hang.
(function () {
  if (typeof Office === "undefined" || !Office.onReady) {
    return;
  }

  const TIMEOUT_MS = 5000;
  const STORAGE_KEY = "xlwings.taskpaneReloadCount";

  let reloadAttempts = 0;
  try {
    const configEl = document.getElementById("config");
    if (configEl) {
      reloadAttempts =
        JSON.parse(configEl.textContent).taskpaneReloadAttempts || 0;
    }
  } catch (e) {
    console.error(
      "taskpane-reload: failed to read config, defaulting to 0 auto-reloads:",
      e,
    );
  }

  // sessionStorage may be unavailable in some WebView contexts. Without it
  // we can't track attempts across reloads — auto-reloading would loop
  // forever. Disable auto-reload in that case; the manual button still works.
  const storageWorks = (() => {
    try {
      const probe = "__xlwings_probe__";
      sessionStorage.setItem(probe, probe);
      sessionStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  })();
  if (!storageWorks && reloadAttempts > 0) {
    console.warn(
      "taskpane-reload: sessionStorage unavailable, disabling auto-reload",
    );
    reloadAttempts = 0;
  }

  const getReloadCount = () => {
    try {
      return parseInt(sessionStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    } catch (e) {
      return 0;
    }
  };

  const setReloadCount = (n) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(n));
    } catch (e) {}
  };

  const clearReloadCount = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };

  let officeReady = false;

  const getOverlay = () =>
    document.getElementById("xlwings-office-ready-error");

  const showReloadPrompt = () => {
    if (officeReady) return;
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.remove("d-none");
    const btn = document.getElementById("xlwings-taskpane-reload-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        clearReloadCount();
        window.location.reload();
      });
    }
  };

  const handleTimeout = () => {
    if (officeReady) return;
    const count = getReloadCount();
    if (count < reloadAttempts) {
      setReloadCount(count + 1);
      window.location.reload();
      return;
    }
    showReloadPrompt();
  };

  const whenDomReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  const timerId = setTimeout(() => whenDomReady(handleTimeout), TIMEOUT_MS);

  Office.onReady().then(
    () => {
      officeReady = true;
      clearTimeout(timerId);
      clearReloadCount();
      const overlay = getOverlay();
      if (overlay) overlay.classList.add("d-none");
    },
    (err) => {
      console.error("Office.onReady() rejected:", err);
      clearTimeout(timerId);
      // Rejection is likely deterministic — skip auto-reload, go straight
      // to the manual button so the user isn't trapped in a reload loop.
      whenDomReady(showReloadPrompt);
    },
  );
})();
