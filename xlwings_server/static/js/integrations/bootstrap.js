// Alerts
document.body.addEventListener("close.bs.alert", function (event) {
  // Prevents alerts from being removed from the DOM when closed so they can be reused
  event.preventDefault();
  event.target.classList.add("d-none");
  return false;
});
