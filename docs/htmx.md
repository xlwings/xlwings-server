# htmx

htmx is a lightweight JavaScript library that allows you to replace parts of your HTML page with snippets from server-rendered HTML templates. This allows you to create dynamic web apps without full page reloads and without the complexity that comes with heavy frameworks such as React.

Most importantly, you keep your application logic and state on the backend where we can use Python instead of JavaScript.

xlwings Server integrates with htmx to facilitate authentication and provide access to the `xlwings.Book` object, enabling interaction with Excel directly from the task pane.

## First steps

htmx works by adding attributes (`hx-...`) to your HTML tags. Let's have a look at a simple [form example](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/htmx_form). The file `taskpane_htmx_form.html` contains this form:

```html
<form hx-post="/hello" hx-target="#result">
  <div class="mb-3">
    <label for="inputName" class="form-label">Name</label>
    <input id="inputName" class="form-control" name="fullname" autocorrect="off" />
  </div>
  <button type="submit" class="btn btn-primary">Submit</button>
</form>
<div id="result" class="mt-4"></div>
```

- `hx-post`: This will trigger a POST request to the indicated endpoint when the button is clicked. It will send the inputs of the form to the backend. Note that `input` elements require a `name` attribute under which the value will be accessible on the backend.
- `hx-target`: this specifies where the response from the server (an HTML snippet), will be swapped. `hx-target="#result"` means that it will be swapped inside the `div` with the `id="result"`. By default, htmx swaps the inner part of the target element. If you wanted to change this to also replace the outer `<div id="result" class="mt-4"></div>`, you would have to add the attribute `hx-swap="outerHTML"`.

On the backend, FastAPI allows you to handle the POST request like this in `taskpane.py`:

```python
@router.post("/hello")
async def hello(request: Request, fullname: str = Form()):
    error = "Please provide a name!" if not fullname else None
    greeting = custom_functions.hello(fullname)
    return TemplateResponse(
        request=request,
        name="/examples/htmx_form/_greeting.html",
        context={"greeting": greeting, "error": error},
    )
```

`fullname: str = Form())` assigns the value of the form input element with the attribute `name=fullname` to the Python variable `fullname`. Finally, here is how the template `_greeting.html` looks like (by convention, the leading underscore indicates a partial HTML template):

```html
<h1>Result</h1>
{% if error %}
  <div class="alert alert-danger" role="alert">{{ error }}</div>
{% else %}
  <p>{{ greeting }}</p>
{% endif %}
```

The `TemplateResponse` renders this template and returns it to the frontend, where htmx takes care of putting it inside the `<div id="result" class="mt-4"></div>`, which, if you write `World` into the name field, will end up looking like this:

```html
<div id="result" class="mt-4">
  <h1>Result</h1>
  <p>Hello World!</p>
</div>
```

## Interacting with Excel

To see how you can interact with the Excel object model from an htmx task pane, have a look at the example [`app/templates/examples/excel_object_model`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/excel_object_model). In summary, here's what you need to do:

- On the same element where you put the `hx-post` attribute, add `xw-book="true"`. This will provide the backend with the content of the workbook. If you need to include or exclude certain sheets, additionally provide `xw-config='{"exclude": "MySheet"}'` as an attribute with the desired [config](officejs_run_scripts.md#config).
- Include the `Book` dependency in your endpoint: `book: dep.Book` (note the import: `from .. import dependencies as dep`).
- Include the `"book"` key in the `context` of your `TemplateResponse`, e.g., `context={"book": book}`. If you call your book object differently, let's say `wb`, it would look like this: `context={"book": wb}`.
- In your template, in the part that is being swapped into the HTML, add the following line: `{% include "_book.html" %}`.
- Note that the `block_names` parameter of the `TemplateResponse` conveniently allows you to select a specific Jinja block that you want to return.

## Security

- Always return your HTML response via `TemplateResponse` to make sure that user inputs are properly escaped.
- Other security-related htmx configs are set under [`app/static/js/core/htmx-handlers.js`](https://github.com/xlwings/xlwings-server/blob/main/app/static/js/core/htmx-handlers.js).
- Read about htmx security in the official docs: https://htmx.org/docs/#security

## Examples

- Simple form: [`app/templates/examples/htmx_form`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/htmx_form)
- Form with Excel interaction: [`app/templates/examples/excel_object_model`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/excel_object_model)
- Authentication: [`app/templates/examples/auth`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples/auth)

## Further Reading

- Docs: [htmx.org](https://htmx.org/)
- Book: [Hypermedia Systems](https://hypermedia.systems/)
