# Implementation Plan: Optional Versioning for Office.js Add-in

> **Note**: The `static/js` paths referenced in this document predate the
> functional restructuring of the JS folder (e.g., `js/core/xlwingsjs/xlwings.js`
> is now `js/custom-scripts/index.js` and `js/core/reload-custom-functions.js`
> is now `js/custom-functions/custom-functions-reload.js`).

## Overview

Add optional versioning support to xlwings Server, allowing users to select versions (v1, v2, etc.) via the xlwings.conf sheet. The backend will serve different versions of custom functions/scripts from subdirectories (e.g., `custom_functions/v1/functions.py`).

## User Requirements Summary

- **UI Approach**: Automatic from xlwings.conf (no UI dropdown needed)
- **Error Handling**: Return error when version doesn't exist (no fallback)
- **Version Format**: Simple format only (v1, v2, v3)
- **Default State**: Opt-in via `XLWINGS_ENABLE_VERSIONING` flag

## Design Principles

1. **100% Backward Compatible**: Works without any changes for existing users
2. **Opt-in Feature**: Disabled by default, requires explicit enablement
3. **Security First**: Strict validation to prevent path traversal attacks
4. **Works Both Modes**: Server-side and Wasm execution
5. **Document-Specific**: Each Excel workbook can use a different version

## Design Decisions & Rationale

### 1. Version Pattern Not Configurable

**Decision**: Keep `_version_pattern` as internal constant in `config.py`, not exposed via `.env`

**Rationale**:

- Simpler API surface - fewer knobs for users to configure
- Security - prevents users from accidentally weakening validation
- Consistency - all deployments use same validation rules
- If needed later, can be made configurable without breaking changes

### 2. Return Field Named `apiVersion`

**Decision**: Use `apiVersion` instead of generic `version`

**Rationale**:

- More specific and clear - indicates this is for API routing
- Avoids conflicts with other "version" fields (xlwings version, Excel version, etc.)
- Follows common convention (e.g., Kubernetes uses `apiVersion`)

### 3. Path Segments Instead of Query Parameters

**Decision**: Use `/xlwings/v1/custom-functions-call` instead of `/xlwings/custom-functions-call?version=v1`

**Rationale**:

- RESTful design - version is part of the resource identifier, not a filter
- Better caching - CDNs and proxies cache based on path
- Cleaner URLs - easier to read and reason about
- Explicit routing - FastAPI can register separate routers for versioned/non-versioned paths
- Follows common API versioning best practices (e.g., `/api/v1/...`, `/api/v2/...`)

**Implementation approach**: Use FastAPI's optional path parameters:

```python
@router.get("/{version}/custom-functions-meta")
@router.get("/custom-functions-meta")  # Backward compatibility
async def custom_functions_meta(version: str | None = None):
    ...
```

**CRITICAL CONSTRAINT - Custom Functions Manifest URLs**:

The Office.js manifest.xml (lines 126-127) has **hardcoded URLs** that are loaded once at add-in startup:

- `Functions.Script.Url` → `/xlwings/custom-functions-code.js`
- `Functions.Metadata.Url` → `/xlwings/custom-functions-meta.json`

These **cannot** include version segments in the manifest itself.

**Solution**: Leverage existing dynamic reload mechanism (currently used for dev mode hot reload):

- `reload-custom-functions.js` uses `Excel.CustomFunctionManager.register()` to dynamically register functions at runtime
- Modify it to read VERSION from xlwings.conf and fetch versioned endpoints
- Enable this script in all environments when versioning is enabled (not just dev mode)
- The manifest URLs stay non-versioned, but the runtime fetch uses versioned URLs

**Trade-off**: Custom functions require the task pane to be opened at least once per session (same limitation as current dev mode). This is acceptable because:

1. Users typically open the task pane to configure settings anyway
2. Alternative would require multiple manifests per version (not feasible)
3. Office.js limitations prevent dynamic manifest modification

### 4. Why Dynamic Import with importlib?

**Decision**: Use `importlib.import_module()` for runtime imports instead of static imports

**Rationale**:

- **Request-time resolution**: Each API request can specify a different version. With static imports at module load time, all requests would use the same version
- **Memory efficiency**: Only load the versions actually being used. If you have v1-v10 but only use v3, why load all 10?
- **No pre-registration needed**: Works with any version folder without editing code. Just create `custom_functions/v11/` and it's immediately available
- **Follows existing pattern**: The codebase already uses dynamic imports (lines 13-21 in xlwings.py) to choose between project and package locations
- **Hot-reload friendly**: In dev mode, can reload specific versions without restarting server

**Alternative considered**: Pre-import all versions at startup

```python
# This would work but has downsides:
import custom_functions.v1
import custom_functions.v2
import custom_functions.v3
VERSIONS = {'v1': custom_functions.v1, 'v2': custom_functions.v2, ...}
```

Problems:

- Must know versions at startup (defeats auto-discovery)
- Loads all versions into memory even if unused
- Harder to extend with new versions
- More code to maintain

## Folder Structure

```
custom_functions/
├── __init__.py          # Default (no version) - backward compatible
├── examples.py          # Default examples
├── v1/
│   ├── __init__.py
│   └── functions.py
├── v2/
│   ├── __init__.py
│   └── functions.py

custom_scripts/
├── __init__.py          # Default (no version)
├── examples.py
├── v1/
│   ├── __init__.py
│   └── scripts.py
└── v2/
    ├── __init__.py
    └── scripts.py
```

## Implementation Steps

### Step 1: Add Configuration Settings

**File**: `xlwings_server/config.py`

Add new settings to the `Settings` class:

```python
# Versioning (around line 80+)
enable_versioning: bool = False  # Feature flag (default off)
_version_pattern: str = r"^v\d+$"  # Internal constant (not configurable via .env)
```

**Environment Variables**:

- `XLWINGS_ENABLE_VERSIONING=true` - Enable versioning feature

### Step 2: Create Version Management Module

**New File**: `xlwings_server/versioning.py`

Create a singleton `VersionManager` class that:

- **Discovers versions**: Scans `custom_functions/` and `custom_scripts/` for subdirectories matching `v\d+` pattern
- **Validates versions**: Strict regex validation + whitelist checking against discovered versions
- **Dynamic imports**: `importlib.import_module()` with version path
- **Caching**: Cache discovered versions to avoid repeated filesystem scans
- **Security**: Prevents path traversal (`../`, etc.)

Key methods:

- `discover_versions(module_name: str) -> list[str]` - Find all v1, v2, etc. folders
- `validate_version(version: str | None, module_name: str) -> str | None` - Validate against whitelist
- `import_versioned_module(module_name: str, version: str | None)` - Dynamic import with fallback

### Step 3: Update Router Endpoints

**File**: `xlwings_server/routers/xlwings.py`

Changes:

1. **Import version manager** (top of file):

   ```python
   from xlwings_server.versioning import version_manager
   ```

2. **Replace static imports** (lines 13-21):

   - Remove: `import custom_functions` / `import custom_scripts`
   - Add: `get_module(module_name: str, version: str | None)` helper function

3. **Add version path segment** to all endpoints:

   - `GET /xlwings/v1/custom-functions-meta` (or `/xlwings/custom-functions-meta` without version)
   - `GET /xlwings/v1/custom-functions-code`
   - `POST /xlwings/v1/custom-functions-call`
   - `POST /xlwings/v1/custom-scripts-call/{script_name}`
   - `GET /xlwings/v1/custom-scripts-meta`
   - `GET /xlwings/v1/pyodide.json` (Wasm mode)

   **Note**: Version is an optional path segment, so routes work both with and without it for backward compatibility

4. **Replace module references**:

   - Change: `custom_functions` → `get_module("custom_functions", version)`
   - Change: `custom_scripts` → `get_module("custom_scripts", version)`

5. **Update logging**:

   - Add version to all log statements: `f"Function '{func_name}' (version: {version or 'default'}) called by {user}"`

6. **Update pyodide.json scanning**:
   - Modify `scan_directory()` to accept optional `version` parameter
   - When version provided: scan `custom_functions/v1/` instead of `custom_functions/`

### Step 4: Frontend JavaScript Changes

**File**: `xlwings_server/static/js/core/xlwingsjs/xlwings.js`

Changes in `getBookData()` function (around line 270):

1. **Extract VERSION from config**:

   ```javascript
   // After line 278 (after AUTH extraction)
   const version = config["VERSION"] || null;
   ```

2. **Return version in bookData**:
   ```javascript
   return {
     payload: payload,
     headers: headers,
     apiVersion: version,  // NEW - renamed for clarity
   };
   ```

Changes in `runPython()` function:

1. **Accept version parameter**:

   ```javascript
   export async function runPython({
     scriptName = "",
     auth = "",
     include = "",
     exclude = "",
     headers = {},
     errorDisplayMode = "alert",
     version = null,  // NEW
   } = {})
   ```

2. **Use version from bookData or parameter**:

   ```javascript
   const effectiveVersion = version || bookData.apiVersion;
   ```

3. **Add version to URL** (server mode):

   ```javascript
   const versionSegment = effectiveVersion ? `/${effectiveVersion}` : '';
   let url = window.location.origin + config.appPath + `/xlwings${versionSegment}/custom-scripts-call/${scriptName}`;
   ```

4. **Pass version to Wasm** (Wasm mode):
   ```javascript
   rawData = await globalThis.wasmCustomScriptsCall(bookData.payload, scriptName, effectiveVersion);
   ```

### Step 5: Custom Functions JavaScript Changes

**CRITICAL CONSTRAINT**: The Office.js manifest.xml has hardcoded URLs for custom functions:

- Line 126: `Functions.Script.Url` → `/xlwings/custom-functions-code.js`
- Line 127: `Functions.Metadata.Url` → `/xlwings/custom-functions-meta.json`

These URLs **cannot** include version path segments because the manifest is loaded once at add-in startup.

**SOLUTION**: Use the existing dynamic reload mechanism (similar to dev mode hot reload):

**File**: `xlwings_server/static/js/core/reload-custom-functions.js`

This file already dynamically registers custom functions at runtime (lines 22-38):

```javascript
const [metadataResponse, codeResponse] = await Promise.all([
  fetch(`${config.appPath}/xlwings/custom-functions-meta.json`),
  fetch(`${config.appPath}/xlwings/custom-functions-code.js`),
]);
await Excel.CustomFunctionManager.register(jsonMetadataString, functionCode);
```

**Modified Approach**:

1. Keep manifest URLs **without** version segments (unchanged)
2. Create a **wrapper/proxy** endpoint that returns non-versioned URLs
3. Use `reload-custom-functions.js` to dynamically load versioned endpoints

**Implementation**:

**File**: `xlwings_server/static/js/core/custom-functions-code.js`

Changes:

1. **Add getVersionFromConfig() helper**:

   ```javascript
   async function getVersionFromConfig() {
     // Read VERSION key from xlwings.conf sheet
     // Return null if not found or sheet doesn't exist
   }
   ```

2. **Update base() function**:

   - Call `getVersionFromConfig()` before making API calls

3. **Update makeServerCall()**:

   - Build URL with version segment: `/xlwings/v1/custom-functions-call` or `/xlwings/custom-functions-call`

4. **Update makeWasmCall()**:
   - Pass version to `globalThis.wasmCustomFunctionsCall(body, version)`

**File**: `xlwings_server/static/js/core/reload-custom-functions.js`

Changes to support version-aware dynamic loading:

1. **Read version from xlwings.conf** before fetching:

   ```javascript
   async function getVersionFromConfig() {
     try {
       await Excel.run(async (context) => {
         const configSheet = context.workbook.worksheets.getItemOrNullObject("xlwings.conf");
         await context.sync();
         if (configSheet.isNullObject) return null;

         const configRange = configSheet.getRange("A1").getSurroundingRegion();
         configRange.load("values");
         await context.sync();

         for (const row of configRange.values) {
           if (row[0] === "VERSION") return row[1] || null;
         }
       });
     } catch { return null; }
   }
   ```

2. **Fetch versioned endpoints**:

   ```javascript
   const version = await getVersionFromConfig();
   const versionSegment = version ? `/${version}` : '';

   const [metadataResponse, codeResponse] = await Promise.all([
     fetch(`${config.appPath}/xlwings${versionSegment}/custom-functions-meta.json`),
     fetch(`${config.appPath}/xlwings${versionSegment}/custom-functions-code.js`),
   ]);
   ```

3. **Always run when versioning is enabled**:
   Currently in `base.html` (line 64-66):

   ```jinja
   {% if settings.environment == "dev" or settings.enable_wasm %}
     <script src="{{ url_for('static', path='/js/core/reload-custom-functions.js') }}" defer></script>
   {% endif %}
   ```

   Update to:

   ```jinja
   {% if settings.environment == "dev" or settings.enable_wasm or settings.enable_versioning %}
     <script src="{{ url_for('static', path='/js/core/reload-custom-functions.js') }}" defer></script>
   {% endif %}
   ```

   This ensures the dynamic loader runs in production when versioning is enabled.

### Step 6: Wasm Mode Updates

**File**: `xlwings_server/wasm/main.py`

Update all Python functions:

1. **custom_functions_call(data, version=None)**:

   - Import versioned module using `version_manager.import_versioned_module("custom_functions", version)`

2. **custom_scripts_call(data, script_name, version=None)**:

   - Import versioned module using `version_manager.import_versioned_module("custom_scripts", version)`

3. **custom_scripts_meta(version=None)**:

   - Import versioned module using `version_manager.import_versioned_module("custom_scripts", version)`

4. **Update JavaScript bindings**:
   - Ensure all Wasm functions accept version parameter from frontend

### Step 7: Static File Mounting (Wasm Mode)

**File**: `xlwings_server/main.py`

No changes needed - `OverridableStaticFiles` already supports subdirectories. The versioned modules will be automatically mounted as static files when Wasm mode is enabled.

## Security Measures

1. **Regex Validation**: `^v\d+$` prevents path traversal attempts like `../`, `./`, `v1; rm -rf /`
2. **Whitelist Checking**: Only discovered versions are allowed (filesystem-based)
3. **Package Validation**: Only directories with `__init__.py` are considered valid versions
4. **Input Sanitization**: Version strings sanitized before logging
5. **Error Messages**: Don't expose filesystem paths in error messages
6. **Logging**: All version access logged with username for audit trail

## Error Handling

When version doesn't exist:

```python
raise ValueError(f"Version {version} not found for {module_name}. Available: {available_versions}")
```

Returns HTTP 400 with clear error message to user.

## Testing Strategy

1. **Unit Tests** (`tests/test_versioning.py`):

   - Version discovery from filesystem
   - Regex validation (reject invalid patterns)
   - Dynamic import with versions
   - Backward compatibility (no version = root module)
   - Security: path traversal attempts

2. **Integration Tests**:

   - Custom functions call with version parameter
   - Custom scripts call with version parameter
   - Wasm mode with versions
   - Error handling when version not found

3. **Manual Testing**:
   - Create v1 and v2 folders with different functions
   - Set VERSION=v1 in xlwings.conf
   - Verify correct version loaded
   - Switch to VERSION=v2 and verify
   - Test without VERSION (backward compatibility)

## Migration Path for Existing Users

**No changes required** - Feature is opt-in:

1. Default: `XLWINGS_ENABLE_VERSIONING=false` (backward compatible)
2. Without VERSION in xlwings.conf: Uses root modules (current behavior)
3. All existing code continues to work unchanged

**To enable versioning**:

1. Set `XLWINGS_ENABLE_VERSIONING=true` in `.env`
2. Create version folders (e.g., `custom_functions/v1/`)
3. Move or copy code into version folders
4. Add `VERSION=v1` to xlwings.conf sheet in workbooks

## Critical Files to Modify

1. **xlwings_server/versioning.py** [NEW] - Core version management logic
2. **xlwings_server/config.py** [MODIFY] - Add versioning settings
3. **xlwings_server/routers/xlwings.py** [MODIFY] - Add version path segments to all endpoints
4. **xlwings_server/static/js/core/xlwingsjs/xlwings.js** [MODIFY] - Extract VERSION from config, pass to API
5. **xlwings_server/static/js/core/custom-functions-code.js** [MODIFY] - Add version support for custom functions
6. **xlwings_server/static/js/core/reload-custom-functions.js** [MODIFY] - Read VERSION and fetch versioned endpoints
7. **xlwings_server/templates/base.html** [MODIFY] - Load reload script when versioning enabled
8. **xlwings_server/wasm/main.py** [MODIFY] - Add version parameter to all functions

## Documentation Requirements

1. **User Guide**: How to enable and use versioning
2. **API Reference**: Document version query parameter on all endpoints
3. **Migration Guide**: Step-by-step for existing projects
4. **Security Notes**: Version validation and path traversal prevention
5. **Example Project**: Sample structure with v1, v2 folders

## Future Enhancements (Out of Scope)

- Semantic versioning support (v1.0.0)
- UI dropdown for version selection
- Version metadata (description, changelog)
- Version deprecation warnings
- Analytics on version usage
