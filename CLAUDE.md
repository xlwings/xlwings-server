# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

xlwings Server is a self-hosted platform that adds Python support to Microsoft Excel and Google Sheets without requiring local Python installations. It uses FastAPI as the web framework and supports multiple integration methods: Office.js add-ins (task panes and custom functions), VBA, Office Scripts, and Google Apps Script. The project also includes "xlwings Wasm" for client-side Python execution using Pyodide.

## Development Commands

Run all Terminal commands with `uv run`.

### Initial Setup

```bash
# Install dependencies
uv sync --group all

# Initialize repo (creates .env, generates UUIDs in config.py)
uv run run.py init
```

### Minimum Python Version and Type Hints

This project requires Python 3.10+ (see `requires-python` in `pyproject.toml`). Use modern Python 3.10+ features:

**Type Hints (PEP 604 and PEP 585):**

- Use `|` for unions: `str | None` instead of `Optional[str]` or `Union[str, None]`
- Use built-in types for generics: `list[str]`, `dict[str, int]` instead of `List[str]`, `Dict[str, int]`
- Only import from `typing` when necessary (e.g., `Literal`, `TypedDict`)

**Examples:**

```python
# Good (Python 3.10+)
def process(data: dict[str, Any], default: str | None = None) -> list[str]:
    ...

# Bad (old style)
from typing import Dict, List, Optional, Union
def process(data: Dict[str, Any], default: Optional[str] = None) -> List[str]:
    ...
```

### Running the Server

```bash
# Standard development server (with hot reload)
uv run run.py

# Or using uvicorn directly with HTTPS
uv run uvicorn xlwings_server.main:main_app --host 0.0.0.0 --port 8000 --reload --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem
```

For production-like local setup with Socket.io on separate port, see DEVELOPER_GUIDE.md.

### Testing

```bash
# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_dependencies.py

# Run with verbose output
uv run pytest -v

# Tests use .env.test for configuration (loaded via conftest.py)
```

### Code Quality

```bash
# Pre-commit hooks (ruff + prettier for JS/HTML/Jinja)
uv pre-commit run --all-files
```

### Wasm Build

```bash
# Build xlwings Wasm distribution
uv run run.py wasm --url <url> --output-dir <dir> [--create-zip] [--clean]
```

### Documentation

```bash
# Build docs with live reload (requires docs/requirements.txt)
uv run sphinx-autobuild docs docs/_build/html --port 9000 -E
```

### NPM Dependencies

Node.js files are vendored - not required for runtime, only for upgrades:

```bash
# Update npm packages
npm install mypackage@latest

# Copy to static folder after updating package.json
uv run scripts/copy_node_modules_to_static_folder.py
```

## Architecture

### Package vs Project Directory Model

xlwings Server 1.0+ uses a Python package distribution model where:

- **PACKAGE_DIR** (`xlwings_server/config.py`): Points to the installed package location in site-packages. Contains core framework code, default templates, and static assets.
- **PROJECT_DIR** (`xlwings_server/config.py`): Points to the user's project directory (set via `XLWINGS_PROJECT_DIR` env var, defaults to cwd). Contains user customizations.

User projects override package defaults by placing files in their project directory:

- `custom_functions/` - User's Excel custom functions (UDFs)
- `custom_scripts/` - User's Python scripts for task pane buttons or ribbon buttons
- `templates/` - Custom Jinja2 templates
- `static/` - Custom CSS/JS
- `config.py` - Optional Settings subclass for custom configuration
- `.env` - Environment-specific settings

The CLI sets `XLWINGS_PROJECT_DIR` before importing the package. Static files and templates are resolved with project directory taking precedence over package directory.

### Application Structure

- **xlwings_server/main.py**: FastAPI application setup, middleware, exception handlers, static file mounting

  - Creates two ASGI apps: `main_app` (CORS-wrapped FastAPI) and `sio_app` (Socket.io wrapper)
  - Mounts static files and conditionally mounts wasm/custom_functions/custom_scripts directories
  - Applies OWASP security headers (configurable via XLWINGS_ADD_SECURITY_HEADERS)

- **xlwings_server/config.py**: Pydantic settings loaded from .env (all settings prefixed with `XLWINGS_`)

  - `Settings` class with computed fields like `static_dir` and `jsconfig`
  - Environment-specific manifest UUIDs (dev/qa/uat/staging/prod)

- **xlwings_server/routers/**: FastAPI routers organized by feature
  - `xlwings.py`: Main Python execution endpoint, custom functions metadata, alerts
  - `taskpane.py`: Task pane rendering and examples
  - `manifest.py`: Office.js manifest generation
  - `root.py`: Root endpoint and health checks
  - `socketio.py`: Socket.io integration for real-time features

### Authentication System

- **xlwings_server/auth/**: Pluggable authentication providers
  - `entraid/`: Microsoft Entra ID (formerly Azure AD) SSO
  - `custom/`: Template for custom auth providers
  - Configured via `XLWINGS_AUTH_PROVIDERS` list in `.env`
  - Auth providers must implement standard interface (see xlwings_server/dependencies.py:authenticate)
  - Supports role-based access control via `XLWINGS_AUTH_REQUIRED_ROLES`

### Object Serialization

- **xlwings_server/serializers/**: Framework for serializing Python objects to/from JSON

  - `framework.py`: Base `Serializer` class and registry system
  - Type-specific serializers: pandas, numpy, dictionary, default
  - Custom encoder/decoder for datetime and registered types
  - Serializers register themselves for specific Python types

- **xlwings_server/object_handles.py**: Object caching system
  - `ObjectCacheConverter`: Custom URL parameter converter for object handles
  - Supports in-memory (dict) or Redis backend (via `XLWINGS_OBJECT_CACHE_URL`)
  - Optional compression with `XLWINGS_OBJECT_CACHE_ENABLE_COMPRESSION`

### Python Execution Modes

1. **Server-side execution**: Python runs on server, called from Excel via xlwings endpoints
2. **xlwings Wasm**: Client-side Python execution using Pyodide (browser-based)
   - **xlwings_server/wasm/**: Separate config and main.py for Wasm mode
   - **xlwings_server/custom_functions/**: Excel custom functions (UDFs) in Python
   - **xlwings_server/custom_scripts/**: Python scripts callable from task pane

### Frontend Integration

- **xlwings_server/static/js/core/**: Core JavaScript functionality

  - `xlwingsjs/`: Auth, utils, sheet-buttons
  - `socketio-handlers.js`: Socket.io client connection
  - `hotreload.js`: Auto-refresh in dev mode
  - Office.js integration and Alpine.js CSP boilerplate

- **xlwings_server/templates/**: Jinja2 templates for task panes and UI
  - Task pane examples in subdirectories
  - Template rendering via `.templates.TemplateResponse`

### Key Dependencies

- **FastAPI**: Web framework with async support
- **uvicorn**: ASGI server
- **xlwings**: Core Excel/Python integration library
- **python-socketio**: Real-time bidirectional communication
- **Pyodide**: Python in WebAssembly (for Wasm mode)
- **Office.js**: Microsoft Office add-in API (frontend)
- **Bootstrap, Alpine.js, HTMX**: Frontend frameworks (configurable via settings)

## Configuration

All settings in .env are prefixed with `XLWINGS_`:

- `XLWINGS_ENVIRONMENT`: dev/qa/uat/staging/prod (affects manifest ID, hot reload, error verbosity)
- `XLWINGS_LICENSE_KEY`: Required for production use
- `XLWINGS_SECRET_KEY`: Auto-generated by `python run.py init`
- `XLWINGS_APP_PATH`: Non-root path when behind reverse proxy (e.g., "/myapp")
- `XLWINGS_ENABLE_*`: Feature flags for examples, tests, socketio, wasm, bootstrap, htmx, etc.

## Important Patterns

### Environment-Specific Behavior

The `XLWINGS_ENVIRONMENT` setting controls multiple behaviors:

- Manifest ID selection (each environment has unique UUID)
- Custom function namespace suffix (e.g., NAMESPACE_DEV.MYFUNC in dev)
- Add-in name display (e.g., "ProjectName [dev]")
- Static file caching (disabled in dev)
- Error message verbosity

### Security Headers

OWASP security headers applied by middleware in main.py unless `XLWINGS_ADD_SECURITY_HEADERS=false`. Special cases:

- Excel Online requires less restrictive headers (Cross-Origin-Resource-Policy, no X-Frame-Options)
- Public add-in store (XLWINGS_CDN_OFFICEJS=true) requires Cross-Origin-Embedder-Policy removal
- Custom headers can override via `XLWINGS_CUSTOM_HEADERS` dict

### Logging and Sanitization

Log injection prevention in `xlwings_server/routers/xlwings.py:sanitize_log_input()` - replaces newlines/carriage returns. Always sanitize user input before logging.

### Hot Reload

In dev mode, `xlwings_server/hotreload.py` uses watchfiles to monitor file changes and trigger browser refresh via SocketIO.

## Testing Notes

- Tests use pytest with pytest-anyio for async test support
- `tests/conftest.py` loads `.env.test` before importing xlwings_server modules (important for settings override)
- Mock settings using `mocker.patch` on `xlwings_server.config.settings`
- Test fixtures use `anyio_backend` fixture for async compatibility

## Common Gotchas

- **Static file vendoring**: JavaScript dependencies in `node_modules/` must be copied to `xlwings_server/static/vendor/` using the copy script
- **Manifest UUIDs**: Each environment needs unique UUIDs - regenerated by `python run.py init`
- **CSP headers**: Restrictive by default. Use `XLWINGS_ENABLE_EXCEL_ONLINE=false` for most restrictive local dev CSP
- **Certificate requirements**: Office.js add-ins require HTTPS with trusted certs even in dev (see docs/dev_certificates.md)
- **Alert window debugging**: Requires separate dev tools instance (see DEVELOPER_GUIDE.md)
- **Pyodide offline mode for self-hosting**: Requires micropip and packaging packages in `xlwings_server/static/vendor/pyodide/`
- **Wasm**: Unless specifically told, work on the FastAPI backend, not the Wasm mode
