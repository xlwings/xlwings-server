xlwings Lite:

- Move office.js and pydodie and everything else behind version dir
- run tests from project dir
- codespaces, docker compose dev, dev containers
- xlwings-server add docker
- one shot script that installs uv, mkcert, xlwings-server init
- docs
- get rid of custom functions/scripts being required dirs
- enable_wasm for the generic case is probably broken when doing xlwings-server and wasm dir doesn't exist. Needs to be created to copy in .env (and all other files?)
