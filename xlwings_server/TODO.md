- docs

- codespaces
- docker compose dev (xlwings-server add docker)
- dev containers
- Move office.js and pyodide and everything else behind version dir

- get rid of custom functions/scripts being required dirs
- enable_wasm for the generic case is probably broken when doing xlwings-server and wasm dir doesn't exist. Needs to be created to copy in .env (and all other files?)
- one shot script that installs uv, mkcert, xlwings-server init
