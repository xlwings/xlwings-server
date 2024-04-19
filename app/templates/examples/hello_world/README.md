# Hello World

This example alternately prints `Hello xlwings!` and `Bye xlwings!` in cell A1 of the first sheet whenever you click the button on the task pane.

It is the default example in `app/routers/taskpane.py`.

The sample also depends on code in:

- `app/static/js/examples.js`
- `app/routers/macros/examples.py`

Instead of using Alpine.js to handle the button click, you could also use plain-vanilla JavaScript like this:

```html
<button class="btn btn-primary btn-sm" type="button" data-js-hello>Hello World</button>
```

and

```js
let helloButton = document.querySelector("[data-js-hello]");
if (helloButton) {
  helloButton.addEventListener("click", async function () {
    let token = await globalThis.getAuth();
    xlwings.runPython(window.location.origin + "/hello", { auth: token });
  });
}
```
