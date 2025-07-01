let lastKnownVersion = null;

async function checkForVersionUpdates() {
  try {
    console.log("checking...");
    const response = await fetch(`${config.appPath}/check-version`);
    const data = await response.json();
    console.log(data.version);

    if (lastKnownVersion && data.version !== lastKnownVersion) {
      xlwings.showGlobalStatus(`New version available`);
      await Office.addin.showAsTaskpane();
      // or reload directly
      // window.location.reload();
    }

    lastKnownVersion = data.version;
  } catch (error) {
    console.error("Error checking version:", error);
  }
}

// Polling
setInterval(checkForVersionUpdates, 5000);

// Initial check
checkForVersionUpdates();
