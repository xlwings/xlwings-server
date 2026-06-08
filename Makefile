.PHONY: serve
serve:
	uv sync --group all
	uv run run.py

.PHONY: serve-dev
serve-dev:
	uv sync --group all
	uv pip install -e ../xlwings
	uv run --no-sync run.py

.PHONY: test
test:
	uv sync --group all
	uv run pytest

.PHONY: tests-dev
tests-dev:
	uv sync --group all
	uv pip install -e ../xlwings
	uv run --no-sync pytest

.PHONY: lint
lint:
	uv sync --group all
	uv run pre-commit run --all-files

.PHONY: docs
docs:
	uv sync --group all
	uv run sphinx-autobuild docs docs/_build/html --port 9000 -E

.PHONY: docs-dev
docs-dev:
	uv sync --group all
	uv pip install -e ../xlwings
	uv run --no-sync sphinx-autobuild docs docs/_build/html --port 9000 -E
