# Introduction

You can look at the task pane as a modern replacement for VBA's user forms. It's a plain-vanilla web app, which allows for maximum flexibility. While xlwings Server uses [FastAPI](https://fastapi.tiangolo.com/) on the backend, you can use any technology you like for the frontend. In the official docs, Microsoft works primarily with [React](https://react.dev), which you could also use with xlwings Server. However, since React is a complex framework and the typical Excel user isn't a professional frontend developer, xlwings Server provides a simpler, but equally powerful stack out of the box:

- [Jinja](https://jinja.palletsprojects.com): A Python-based template engine.
- [htmx](https://htmx.org/): A library for client-server interaction without full page reloads.
- [Alpine.js CSP build](https://alpinejs.dev/advanced/csp) An alternative for plain-vanilla JavaScript for client-side interactions.
- [Bootstrap](https://getbootstrap.com/): A user interface (UI) toolkit. [Bootstrap-xlwings](https://github.com/xlwings/bootstrap-xlwings) is a theme in the Excel look.

What all these libraries have in common is:

- Developer experience: all of these libraries work without a JavaScript build tool such as webpack.
- Security: they are compatible with the most restrictive [CSP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP).
- Flexibility: these are libraries, not frameworks, so you can replace any or all of them without rewriting the entire application.
- Easy to pick up: even if you haven't done any web development previously, you will be able to ship something that works by starting with the [included examples](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples).

If you opt for a different stack, don't forget to disable those libraries that you don't use, see [](production.md). You should also note that the chosen libraries have been pre-configured for xlwings Server, providing benefits such as:

- Jinja: integration with [jinja2-fragments](https://github.com/sponsfreixes/jinja2-fragments) allows to easily return partials for htmx
- htmx: integrated authentication and access to the Excel object model
- Alpine.js CSP build: easy registration of components via `registerAlpineComponent()`
- Bootstrap: beautiful theme in the Excel look

Start by looking at [`app/templates/examples`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples) to get up and running quickly.
