# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

xlwings Server is a self-hosted platform that adds Python support to Microsoft Excel and Google Sheets without requiring local Python installations. It uses FastAPI as the web framework and supports multiple integration methods: Office.js add-ins (task panes and custom functions), VBA, Office Scripts, and Google Apps Script. The project also includes "xlwings Wasm" for client-side Python execution using Pyodide.

## Development Commands

### Conda environment activation

Run all Terminal commands with an activated conda environment:

```bash
conda activate xlwings-server
```

### Initial Setup

```bash
# Install uv package manager
pip install uv

# Install dependencies
uv pip sync requirements-dev.txt

# Initialize repo (creates .env, generates UUIDs in config.py)
python run.py init
```

### Running the Server

```bash
# Standard development server (with hot reload)
python run.py

# Or using uvicorn directly with HTTPS
uvicorn app.main:main_app --host 0.0.0.0 --port 8000 --reload --ssl-keyfile ./certs/localhost+2-key.pem --ssl-certfile ./certs/localhost+2.pem
```

For production-like local setup with Socket.io on separate port, see DEVELOPER_GUIDE.md.

### Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_dependencies.py

# Run with verbose output
pytest -v

# Tests use .env.test for configuration (loaded via conftest.py)
```

### Dependency Management

```bash
# Compile dependencies (after editing requirements*.in files)
python run.py deps compile

# Upgrade all dependencies to latest versions
python run.py deps upgrade
```

### Code Quality

```bash
# Ruff handles both linting and formatting (configured in pyproject.toml)
ruff check .
ruff format .

# Pre-commit hooks (ruff + prettier for JS/HTML/Jinja)
pre-commit install
pre-commit run --all-files

# Prettier for frontend files (JS, HTML, Jinja templates)
# Note: VS Code extension requires explicit .prettierrc.js config
```

### Wasm Build

```bash
# Build xlwings Wasm distribution
python run.py wasm --url <url> --output-dir <dir> [--create-zip] [--clean]
```

### Documentation

```bash
# Build docs with live reload (requires docs/requirements.txt)
sphinx-autobuild docs docs/_build/html --port 9000 -E
```

### NPM Dependencies

Node.js files are vendored - not required for runtime, only for upgrades:

```bash
# Update npm packages
npm install mypackage@latest

# Copy to static folder after updating package.json
python scripts/copy_node_modules_to_static_folder.py
```

## Architecture

### Application Structure

- **app/main.py**: FastAPI application setup, middleware, exception handlers, static file mounting

  - Creates two ASGI apps: `main_app` (CORS-wrapped FastAPI) and `sio_app` (Socket.io wrapper)
  - Mounts static files and conditionally mounts wasm/custom_functions/custom_scripts directories
  - Applies OWASP security headers (configurable via XLWINGS_ADD_SECURITY_HEADERS)

- **app/config.py**: Pydantic settings loaded from .env (all settings prefixed with `XLWINGS_`)

  - `Settings` class with computed fields like `static_dir` and `jsconfig`
  - Environment-specific manifest UUIDs (dev/qa/uat/staging/prod)

- **app/routers/**: FastAPI routers organized by feature
  - `xlwings.py`: Main Python execution endpoint, custom functions metadata, alerts
  - `taskpane.py`: Task pane rendering and examples
  - `manifest.py`: Office.js manifest generation
  - `root.py`: Root endpoint and health checks
  - `socketio.py`: Socket.io integration for real-time features

### Authentication System

- **app/auth/**: Pluggable authentication providers
  - `entraid/`: Microsoft Entra ID (formerly Azure AD) SSO
  - `custom/`: Template for custom auth providers
  - Configured via `XLWINGS_AUTH_PROVIDERS` list in `.env`
  - Auth providers must implement standard interface (see app/dependencies.py:authenticate)
  - Supports role-based access control via `XLWINGS_AUTH_REQUIRED_ROLES`

### Object Serialization

- **app/serializers/**: Framework for serializing Python objects to/from JSON

  - `framework.py`: Base `Serializer` class and registry system
  - Type-specific serializers: pandas, numpy, dictionary, default
  - Custom encoder/decoder for datetime and registered types
  - Serializers register themselves for specific Python types

- **app/object_handles.py**: Object caching system
  - `ObjectCacheConverter`: Custom URL parameter converter for object handles
  - Supports in-memory (dict) or Redis backend (via `XLWINGS_OBJECT_CACHE_URL`)
  - Optional compression with `XLWINGS_OBJECT_CACHE_ENABLE_COMPRESSION`

### Python Execution Modes

1. **Server-side execution**: Python runs on server, called from Excel via xlwings endpoints
2. **xlwings Wasm**: Client-side Python execution using Pyodide (browser-based)
   - **app/wasm/**: Separate config and main.py for Wasm mode
   - **app/custom_functions/**: Excel custom functions (UDFs) in Python
   - **app/custom_scripts/**: Python scripts callable from task pane

### Frontend Integration

- **app/static/js/core/**: Core JavaScript functionality

  - `xlwingsjs/`: Auth, utils, sheet-buttons
  - `socketio-handlers.js`: Socket.io client connection
  - `hotreload.js`: Auto-refresh in dev mode
  - Office.js integration and Alpine.js CSP boilerplate

- **app/templates/**: Jinja2 templates for task panes and UI
  - Task pane examples in subdirectories
  - Template rendering via `app.templates.TemplateResponse`

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

Log injection prevention in `app/routers/xlwings.py:sanitize_log_input()` - replaces newlines/carriage returns. Always sanitize user input before logging.

### Hot Reload

In dev mode, `app/hotreload.py` uses watchfiles to monitor file changes and trigger browser refresh via SocketIO.

## Testing Notes

- Tests use pytest with pytest-anyio for async test support
- `tests/conftest.py` loads `.env.test` before importing app modules (important for settings override)
- Mock settings using `mocker.patch` on `app.config.settings`
- Test fixtures use `anyio_backend` fixture for async compatibility

## Working with xlwings Python Package

To develop against local xlwings package in editable mode:

```bash
cd ../xlwings
python setup.py develop
cd ../xlwings-server
pip uninstall xlwings  # Remove installed version first
```

## Common Gotchas

- **Static file vendoring**: JavaScript dependencies in `node_modules/` must be copied to `app/static/vendor/` using the copy script
- **Manifest UUIDs**: Each environment needs unique UUIDs - regenerated by `python run.py init`
- **CSP headers**: Restrictive by default. Use `XLWINGS_ENABLE_EXCEL_ONLINE=false` for most restrictive local dev CSP
- **Certificate requirements**: Office.js add-ins require HTTPS with trusted certs even in dev (see docs/dev_certificates.md)
- **Alert window debugging**: Requires separate dev tools instance (see DEVELOPER_GUIDE.md)
- **Pyodide offline mode for self-hosting**: Requires micropip and packaging packages in `app/static/vendor/pyodide/`
- **Wasm**: Unless specifically told, work on the FastAPI backend, not the Wasm mode
