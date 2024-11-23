# xlwings Lite

```{toctree}
:maxdepth: 1
:hidden:

lite_limitations.md
```

xlwings Lite leverages the browser runtime provided by Office.js add-ins to run Python code locally on the end-user's machine. Installing Python isn't required --- neither on end users' computers nor on the server.

This means that you can host your add-in on a simple static hosting service like [Cloudflare Pages](https://pages.cloudflare.com/) or [GitHub Pages](https://docs.github.com/en/pages) for free. For on-premise, you might want to use nginx, Apache HTTP Server, or something similar.

The ease of deployment comes at the cost of certain limitations though. xlwings Lite is based on [Pyodide](https://pyodide.org), which is a Python distribution for WebAssembly (Wasm). WebAssembly is a technology that allows running programming languages like Python directly in web browsers at near-native speed.

In practice, this means that you can't run all packages. For example, [Polars](https://pola.rs) currently isn't supported. You also can't directly access SQL databases such as PostgreSQL (SQLite, however, is supported). Furthermore, since Python runs in the browser, you also don't have access to the local file system, but you could easily build a file uploader via the task pane or access them via web API. The good news is that if you hit a hard limit, you can always switch to xlwings Server with minimal efforts to get access to a full Python installation on the backend.

For a complete overview, see [](lite_limitations.md).
