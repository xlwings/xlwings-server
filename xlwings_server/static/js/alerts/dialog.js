if (document.getElementById("ok")) {
  document.getElementById("ok").addEventListener("click", buttonCallback);
}
if (document.getElementById("yes")) {
  document.getElementById("yes").addEventListener("click", buttonCallback);
}
if (document.getElementById("no")) {
  document.getElementById("no").addEventListener("click", buttonCallback);
}
if (document.getElementById("cancel")) {
  document.getElementById("cancel").addEventListener("click", buttonCallback);
}
function buttonCallback() {
  Office.onReady(() => {
    // This causes this issue: https://github.com/OfficeDev/office-js/issues/3582
    Office.context.ui.messageParent(
      this.id +
        "|" +
        document.getElementById("callback").getAttribute("data-callback"),
    );
  });
}
