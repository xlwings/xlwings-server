# xlwings Lite

```{toctree}
:maxdepth: 1
:hidden:

lite_development.md
lite_deployment.md
lite_limitations.md
```

xlwings Lite allows you to create an Office.js add-in without running Python on the server. To do so, xlwings Lite leverages the browser runtime provided by Office.js add-ins to run Python code locally. Installing Python isn't required --- neither on end users' computers nor on the server. In a little more detail, xlwings Lite is based on [Pyodide](https://pyodide.org), which is a Python distribution for WebAssembly (Wasm). WebAssembly is a technology that allows running programming languages like Python directly in web browsers at near-native speed.

This means that you can host your add-in files incl. the Python code on a simple static hosting service like [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://docs.github.com/en/pages) for free. For on-premise, you might want to use nginx, Apache HTTP Server, or something similar. One of the advantages of using xlwings Lite is that you can have thousands of concurrent users for free, while with xlwings Server, this might require to run an expensive server to keep up with the load. Another advantage is that you get rid of the server roundtrip, which can improve performance.

The ease of deployment comes at the cost of certain limitations though. The biggest restriction is that Pyodide can't run all packages. For example, [Polars](https://pola.rs) currently isn't supported. You also can't directly access SQL databases such as PostgreSQL (SQLite, however, is supported). Furthermore, since Python runs in the browser, you don't have access to the local file system, but you could easily build a file uploader via the task pane or access them via web API. And finally, authentication is also not supported. The good news is that if you hit a hard limit, you can always switch to xlwings Server with minimal efforts. For an depth overview of the limitations, see [](lite_limitations.md).
