// Office.onReady() can hang indefinitely when Excel restores a task pane
// before the add-in host channel is wired up (typical on Windows after
// closing and reopening Excel). Auto-reload a bounded number of times
// since a single reload usually clears it; fall back to a manual reload
// button so the user has an escape if the auto-retries also hang.
(function () {
  const TIMEOUT_MS = 5000;
  const STORAGE_KEY = "xlwingsTaskpaneReloadCount";
  const REASON_KEY = "xlwingsTaskpaneReloadReason";

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
    console.log(
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
      sessionStorage.removeItem(REASON_KEY);
    } catch (e) {}
  };

  const setReloadReason = (reason) => {
    try {
      sessionStorage.setItem(REASON_KEY, reason);
    } catch (e) {}
  };

  const getReloadReason = () => {
    try {
      return sessionStorage.getItem(REASON_KEY);
    } catch (e) {
      return null;
    }
  };

  const lastReason = getReloadReason();
  console.log(
    `taskpane-reload: active (timeout=${TIMEOUT_MS}ms, budget=${reloadAttempts}, count=${getReloadCount()}${lastReason ? `, last=${lastReason}` : ""})`,
  );

  let officeReady = false;

  const getOverlay = () =>
    document.getElementById("xlwings-office-ready-error");

  const showReloadPrompt = () => {
    if (officeReady) return;
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.remove("d-none");
  };

  // Wire up the prompt's buttons once at script load. The overlay markup
  // lives in base.html so the buttons exist before showReloadPrompt() ever
  // runs, and binding here avoids attaching duplicate handlers if the
  // prompt is triggered more than once (e.g., timer + onReady rejection).
  const wireButtons = () => {
    const reloadBtn = document.getElementById("xlwings-taskpane-reload-btn");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        // Exhaust the auto-reload budget so the next page load is a single
        // user-driven try, not another silent retry cycle. If it fails again,
        // the prompt reappears and the user clicks again.
        setReloadCount(reloadAttempts);
        window.location.reload();
      });
    }
    const cancelBtn = document.getElementById(
      "xlwings-taskpane-reload-cancel-btn",
    );
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        clearReloadCount();
        const overlay = getOverlay();
        if (overlay) overlay.classList.add("d-none");
      });
    }
  };

  // Auto-reload up to reloadAttempts, then show the manual prompt.
  // Used by the 5s timer, by Office.onReady() rejection, and by
  // Office.onReady() resolving with no host.
  const recoverOrPrompt = () => {
    if (officeReady) return;
    const count = getReloadCount();
    if (count < reloadAttempts) {
      const next = count + 1;
      setReloadCount(next);
      console.log(
        `taskpane-reload: auto-reloading (attempt ${next}/${reloadAttempts})`,
      );
      window.location.reload();
      return;
    }
    console.log(
      `taskpane-reload: budget exhausted (${reloadAttempts} attempts), showing manual prompt`,
    );
    showReloadPrompt();
  };

  const whenDomReady = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  };

  whenDomReady(wireButtons);

  const timerId = setTimeout(() => {
    setReloadReason("timeout");
    whenDomReady(recoverOrPrompt);
  }, TIMEOUT_MS);

  // Only attach the Office.onReady handler if it's actually available.
  // If office.js failed to load (Office is undefined or onReady is missing),
  // the timer above is what surfaces the reload UI — no handler needed.
  if (typeof Office !== "undefined" && Office.onReady) {
    Office.onReady().then(
      (info) => {
        // Office.onReady() can resolve with info.host = undefined when
        // Office.js initialized but never attached to the host (Excel) — a
        // recoverable failure observed on Windows after restarting Excel.
        // Trigger recovery now rather than waiting for the timer; this
        // auto-reloads if the budget allows, or shows the manual prompt.
        if (!info || !info.host) {
          console.log(
            "taskpane-reload: Office.onReady() resolved without a host, attempting recovery",
          );
          setReloadReason("no-host");
          clearTimeout(timerId);
          whenDomReady(recoverOrPrompt);
          return;
        }
        officeReady = true;
        clearTimeout(timerId);
        clearReloadCount();
        const overlay = getOverlay();
        if (overlay) overlay.classList.add("d-none");
      },
      (err) => {
        console.error("Office.onReady() rejected:", err);
        setReloadReason("rejected");
        clearTimeout(timerId);
        whenDomReady(recoverOrPrompt);
      },
    );
  }
})();
