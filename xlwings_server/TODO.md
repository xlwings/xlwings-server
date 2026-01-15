xlwings Lite:

- Make main.js work as module in xlwings lite
- Move office.js and pydodie behind version dir
- 1.0.0a0 needs changes in: config.py has additional param from xlwings lite:
  "addinVersion": self.addin_version,
  "enablePypi": self.enable_pypi,
  "cdnPyodide": self.cdn_pyodide,
  and xlwings.py router (fixed in source)
- axios needs to be moved/or remove 'defer'
- hide default loading spinner in wasm.js

- run tests from project dir
- codespaces, docker compose dev, dev containers
- xlwings-server add docker
- one shot script that installs uv, mkcert, xlwings-server init
- docs
