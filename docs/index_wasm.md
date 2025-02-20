# xlwings Wasm

```{toctree}
:maxdepth: 1
:hidden:

lite_development.md
lite_deployment.md
lite_limitations.md
```

xlwings Wasm allows you to create an Office.js add-in without running Python on the server. To do so, xlwings Wasm runs Python locally in the browser that comes with Office.js add-ins. Installing Python isn't required --- neither on end users' computers nor on the server. In a little more detail, xlwings Wasm is based on [Pyodide](https://pyodide.org), which is a Python distribution for WebAssembly (Wasm). WebAssembly is a technology that allows running programming languages like Python directly in web browsers at near-native speed.

This means that you can host your add-in files incl. the Python code on a simple static hosting service like [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://docs.github.com/en/pages) for free. For on-premise, you might want to use nginx, Apache HTTP Server, or something similar. One of the advantages of using xlwings Wasm is that you can have thousands of concurrent users for free, while with xlwings Server, this might require running an expensive server to keep up with the load. Another advantage is that you get rid of the server roundtrip, which can improve performance.

These advantages come at the cost of certain limitations though: Pyodide can't run packages that depend on the `multiprocessing` or `threading` module. You also can't directly access SQL databases such as PostgreSQL (SQLite, however, is supported). Furthermore, since Python runs in the browser, accessing local files is a little harder. And finally, there's no support for authentication. For an in-depth overview of these limitations, see [](lite_limitations.md).

The good news is that you can migrate to xlwings Server any time by changing a single setting whenever you encounter an xlwings Wasm limitation.
