.PHONY: serve
serve:
	uv run run.py

.PHONY: test
test:
	uv run pytest

.PHONY: lint
lint:
	uv run pre-commit run --all-files

.PHONY: docs
docs:
	uv run sphinx-autobuild docs docs/_build/html --port 9000 -E
