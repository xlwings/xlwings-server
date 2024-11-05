# Jinja

Jinja is a templating engine that uses a syntax similar to Python. In xlwings Server, it is used to render the HTML files that define your add-in including the task pane. Note that the Jinja package is called Jinja2, but we refer to it simply as Jinja in this document.

## First steps

Under [`app/routers/taskpane.py`](https://github.com/xlwings/xlwings-server/blob/main/app/routers/taskpane.py), you can see that you render HTML templates via `TemplateResponse`. To learn the basics of Jinja templating, first, replace `taskpane.py` with the following:

```python
from fastapi import APIRouter, Request

from ..templates import TemplateResponse

router = APIRouter()


@router.get("/taskpane")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request,
        name="/examples/hello_world/taskpane_hello.html",
        context={
            "languages": ["Python", "Java", "JavaScript"],
            "show": True,
            "title": "Languages",
        },
    )

```

Then, replace the content of [`app/templates/examples/hello_world/taskpane_hello.html`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/examples/hello_world/taskpane_hello.html) with the following:

```jinja
{% extends "base.html" %}

{% block content %}
  <h1>{{ title }}</h1>
  {% if show %}
    <ul>
      {% for language in languages %}
        <li>{{ language }}</li>
      {% endfor %}
    </ul>
  {% endif %}
{% endblock content %}
```

The values passed in the `context` dictionary will be available as variables under the names of the dictionary keys. You can put variables in between double curly braces to render their values:

```jinja
{{ myname }}
```

On the other hand, control structures such as if statements and for loops are written like this:

```jinja
{% if myname == "something" %}
```

Finally, comments can be written like this:

```jinja
{# a comment #}
```

In Jinja templates, you can access methods and attributes directly on objects. Note that Jinja allows attribute access via dot notation in addition to the usual square brackets:

```jinja
{{ item.method() }}
{{ item[attribute] }}
{{ item.attribute }}
```

Two more things need to be explained:

```jinja
{% extends "base.html" %}
```

This means that the content of `taskpane_hello.html` will be placed into `base.html` for rendering. More precisely, it takes the content block, as defined via

```jinja
{% block content %}
  ...
{% endblock content %}
```

and puts it in the location where `base.html` shows the block with this same name.

If you use [](htmx.md), the `block_names` parameter in `TemplateResponse` can be used to return specific parts of your HTML file.

```{note}
The `settings` variable is provided behind the scenes, so you can directly use it in your templates without providing it via `context`, e.g., to access the `XLWINGS_ENVIRONMENT` setting, you can use `settings.environment`. I.e., settings are lowercase and without the `XLWINGS_` prefix, see [`app/config.py`](https://github.com/xlwings/xlwings-server/blob/main/app/config.py).
```

## Tutorial

For an in-depth tutorial about Jinja templating, have a look at the [official docs](https://jinja.palletsprojects.com/en/stable/templates/).

## Partials

By convention, xlwings Server uses a leading underscore in HTML files to indicate that the file contains only a snippet of HTML, which doesn't render to a complete HTML page, see e.g., [`app/templates/_book.html`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/_book.html).

If you use [](htmx.md), you will often return such snippets directly. Otherwise, you can put reusable HTML code in there, which you can include in other files via the following syntax:

```jinja
{% include "_book.html" %}
```

## Further Reading

- [Official Docs](https://jinja.palletsprojects.com/en/stable/templates/)
