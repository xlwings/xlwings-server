# Migration to xlwings Server 1.0

- python run.py -> xlwings-server CLI
- Minimal supported Python version is 3.10
- UUIDs from config.py -> pyproject.toml
- XLWINGS_ENABLE_EXAMPLES is now false and will likely go away completely
- import from `xlwings` rather than `xlwings.server`
