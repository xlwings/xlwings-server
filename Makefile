.PHONY: serve
serve:
	uv sync --group all
	uv run run.py

.PHONY: serve-dev
serve-dev:
	uv sync --group all
	uv pip install -e ../xlwings
	uv run --no-sync run.py

# Mirrors the CI test job: the .env variants exercise different feature flags, so a
# change can pass under one and fail under another (e.g. example functions that are only
# registered when Wasm is disabled)
.PHONY: tests
tests: tests-js
	uv sync --group all
	uv run pytest
	ENV_FILE=".env.test2" uv run --no-sync pytest tests/test_env2.py
	ENV_FILE=".env.testwasm" uv run --no-sync pytest

.PHONY: tests-dev
tests-dev: tests-js
	uv sync --group all
	uv pip install -e ../xlwings
	uv run --no-sync pytest
	ENV_FILE=".env.test2" uv run --no-sync pytest tests/test_env2.py
	ENV_FILE=".env.testwasm" uv run --no-sync pytest

# --ignore-scripts skips the postinstall hook, which vendors the npm packages into the
# static folder - not needed to run the JS tests
.PHONY: tests-js
tests-js:
	npm install --ignore-scripts
	npm test

.PHONY: lint
lint:
	uv sync --group all
	uv run pre-commit run --all-files

.PHONY: officejs
officejs:
	uv sync --group all
	uv run scripts/mirror_officejs.py

.PHONY: officejs-check
officejs-check:
	uv sync --group all
	uv run scripts/mirror_officejs.py --check

.PHONY: docs
docs:
	uv sync --group all
	uv run sphinx-autobuild docs docs/_build/html --port 9000 -E

.PHONY: docs-dev
docs-dev:
	uv sync --group all
	uv pip install -e ../xlwings
	uv run --no-sync sphinx-autobuild docs docs/_build/html --port 9000 -E
