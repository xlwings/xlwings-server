# Introduction

The great thing about the Office.js task pane is that it is a plain-vanilla web app allowing you to use any frontend technology you like. In the official docs, Microsoft works primarily with [React](https://react.dev), which you could also use with xlwings Server. However, since React is a complex framework and the typical Excel user isn't a professional frontend developer, xlwings Server provides a simpler yet very powerful stack out of the box:

- [Jinja](https://jinja.palletsprojects.com): A Python-based template engine.
- [htmx](https://htmx.org/): A library for client-server interaction without full page reloads.
- [Alpine.js CSP build](https://alpinejs.dev/advanced/csp) An alternative for plain-vanilla JavaScript for client-side interactions.
- [Bootstrap](https://getbootstrap.com/): A design framework. [Bootstrap-xlwings](https://github.com/xlwings/bootstrap-xlwings) is a theme in the Excel look.

If you opt for a different stack, don't forget to disable those libraries that you don't use, see [](production.md).

Start by looking at [`app/templates/examples`](https://github.com/xlwings/xlwings-server/tree/main/app/templates/examples) to get up and running quickly.
