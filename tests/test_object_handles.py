import uuid

import pandas as pd
import pytest
import xlwings as xw

from xlwings_server import object_handles as oh
from xlwings_server.routers import xlwings as xlwings_router

Converter = oh.ObjectCacheConverter


@pytest.fixture(autouse=True)
def _cache_context():
    # In-memory cache (no Redis configured in .env.test) and clean contextvars per test.
    # Register the converter as main.py does, so resolution via conversion.read() works.
    Converter.register(object, "object", "obj")
    xlwings_router.redis_client_context.set(None)
    xlwings_router.user_id_context.set(None)
    oh.cache.clear()
    yield
    oh.cache.clear()


def _write(obj, options=None):
    """Writes an object handle and returns (entity, cache_key)."""
    entity = Converter.write_value(obj, options or {})
    key = entity["properties"][oh.RESERVED_PROPERTY]["basicValue"]
    return entity, key


def test_write_value_returns_entity_with_hidden_cache_key():
    df = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    entity, key = _write(df)

    assert entity["type"] == "Entity"
    assert entity["text"] == "DataFrame"
    # The cache key is a UUID stored in the reserved property...
    uuid.UUID(key)
    # ...which is excluded from the card and formulas so it stays hidden from the user
    # while still travelling with the Entity (survives copy/paste and `=A1`).
    exclusions = entity["properties"][oh.RESERVED_PROPERTY]["propertyMetadata"][
        "excludeFrom"
    ]
    assert exclusions["cardView"] is True
    assert exclusions["dotNotation"] is True
    # calcCompare must NOT be excluded: the UUID has to take part in recalc
    # change-detection so consumers (e.g. =VIEW(A1)) recalculate when the handle changes.
    assert "calcCompare" not in exclusions
    # Derived properties are present.
    assert set(entity["properties"]) >= {"Type", "Shape", "Columns", "Index"}


def test_roundtrip_resolves_same_object():
    df = pd.DataFrame({"a": [1, 2]})
    _, key = _write(df)
    assert Converter.read_value(key, {}).equals(df)


def test_empty_dataframe_does_not_break_handle_creation():
    # An empty DataFrame is a valid result; deriving the Index property must not read
    # obj.index[0] (which would raise IndexError on an empty index).
    entity, key = _write(pd.DataFrame({"a": []}))
    assert entity["properties"]["Index"]["basicValue"] == "RangeIndex: 0 entries"
    assert Converter.read_value(key, {}).empty


def test_read_value_raises_on_cache_miss():
    with pytest.raises(xw.ObjectCacheMissError) as excinfo:
        Converter.read_value(str(uuid.uuid4()), {})
    assert excinfo.value.key is not None


def test_read_value_rejects_foreign_entity():
    # The frontend sends a plain marker string (not a dict) for a non-handle Entity, so it
    # passes through xlwings' value cleaning unchanged before reaching read_value.
    with pytest.raises(xw.XlwingsError, match="not an xlwings object handle"):
        Converter.read_value(oh.NOT_A_HANDLE_MARKER, {})


def test_not_a_handle_error_is_not_retryable():
    # End-to-end through the route: a foreign-entity marker must surface as a deliberate
    # client error whose status code is NOT in the retry codes, so custom functions don't
    # retry a deterministic failure.
    from fastapi.testclient import TestClient

    from xlwings_server.config import settings
    from xlwings_server.main import main_app

    client = TestClient(main_app, raise_server_exceptions=False)
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "view",
            "args": [[[oh.NOT_A_HANDLE_MARKER]]],
            "caller_address": "Sheet1!A1",
            "version": xw.__version__,
            "client": "Office.js",
            "runtime": "1.4",
        },
    )
    assert response.status_code not in settings.custom_functions_retry_codes
    assert "not an xlwings object handle" in response.text


def test_cache_backend_unreachable_is_retryable(mocker):
    # A transient operational failure (cache backend down) must return a retryable status,
    # unlike the deterministic client errors above.
    from fastapi.testclient import TestClient

    from xlwings_server.config import settings
    from xlwings_server.main import main_app

    # Pretend Redis is configured; with no client in context, _redis_client() raises
    # XlwingsOperationalError when get_df tries to write.
    mocker.patch.object(settings, "object_cache_url", "redis://localhost:6379/0")
    client = TestClient(main_app, raise_server_exceptions=False)
    response = client.post(
        f"{settings.app_path}/xlwings/custom-functions-call",
        json={
            "func_name": "get_df",
            "args": [],
            "caller_address": "Sheet1!A1",
            "version": xw.__version__,
            "client": "Office.js",
            "runtime": "1.4",
        },
    )
    assert response.status_code == 503
    assert response.status_code in settings.custom_functions_retry_codes


def test_object_handle_wrapper_customizes_presentation():
    df = pd.DataFrame({"a": [1]})
    handle = xw.ObjectHandle(
        df,
        text="1 row",
        icon=xw.ObjectHandleIcons.table,
        properties={"Region": {"type": "String", "basicValue": "EU"}},
    )
    entity, key = _write(handle)

    assert entity["text"] == "1 row"
    assert entity["layouts"]["compact"]["icon"] == xw.ObjectHandleIcons.table.value
    assert entity["properties"]["Region"]["basicValue"] == "EU"
    # Supplied properties are the complete set: the auto-derived ones are NOT shown
    # (only the supplied properties plus the always-present reserved cache key).
    assert set(entity["properties"]) == {"Region", oh.RESERVED_PROPERTY}
    # The wrapped object (not the wrapper) is what gets cached.
    assert Converter.read_value(key, {}).equals(df)


def test_object_handle_without_properties_keeps_derived_ones():
    # When no properties are supplied, the auto-derived ones are still shown.
    handle = xw.ObjectHandle(pd.DataFrame({"a": [1]}), text="just text")
    entity, _ = _write(handle)
    assert set(entity["properties"]) >= {"Type", "Shape", "Columns", "Index"}


def test_object_handle_properties_cannot_shadow_reserved_key():
    handle = xw.ObjectHandle(
        pd.DataFrame({"a": [1]}),
        properties={oh.RESERVED_PROPERTY: {"type": "String", "basicValue": "hacked"}},
    )
    with pytest.raises(xw.XlwingsError):
        Converter.write_value(handle, {})


def test_keys_are_global_by_default():
    df = pd.DataFrame({"a": [1]})
    xlwings_router.user_id_context.set("user_a")
    _, key = _write(df)
    # A different user resolves the same handle (object handles are portable by default).
    xlwings_router.user_id_context.set("user_b")
    assert Converter.read_value(key, {}).equals(df)


def test_partition_by_user_isolates_objects(mocker):
    mocker.patch("xlwings_server.config.settings.object_cache_partition_by_user", True)
    df = pd.DataFrame({"a": [1]})
    xlwings_router.user_id_context.set("user_a")
    _, key = _write(df)

    xlwings_router.user_id_context.set("user_a")
    assert Converter.read_value(key, {}).equals(df)

    # A different user can't resolve another user's cached object.
    xlwings_router.user_id_context.set("user_b")
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(key, {})


def test_partition_by_user_requires_a_user(mocker):
    # With partitioning on, an unauthenticated request (no user id) must fail loudly rather
    # than silently bucketing everyone into a shared partition (false isolation).
    mocker.patch("xlwings_server.config.settings.object_cache_partition_by_user", True)
    xlwings_router.user_id_context.set(None)
    with pytest.raises(xw.XlwingsError, match="requires an authenticated user"):
        Converter.write_value(pd.DataFrame({"a": [1]}), {})


def test_stale_object_handle():
    # Custom function results must be a 2D array, so the stale entity is wrapped in [[...]].
    result = oh.stale_object_handle()
    assert isinstance(result, list) and isinstance(result[0], list)
    entity = result[0][0]
    # The text must not look like an Excel error literal (e.g. "#STALE!"), or Excel renders
    # the cell as a #VALUE! error instead of an object handle card.
    assert not entity["text"].startswith("#")
    # The card points at Excel's built-in recalc (no custom refresh button exists).
    status = entity["properties"]["Status"]["basicValue"]
    assert "recalculate" in status
    assert "Ctrl+Alt+F9" in status
    # The icon must be the serialized enum value (a string), not the enum object.
    assert isinstance(entity["layouts"]["compact"]["icon"], str)


def test_object_handle_type_hint_resolves_via_cache():
    # ObjectHandle[T] opts an argument into object-cache resolution while keeping T as the
    # type seen by editors/type checkers, instead of having to annotate the arg as object.
    from xlwings.server import func

    @func
    async def view(obj: xw.ObjectHandle[pd.DataFrame]):
        return obj

    arg_options = view.__xlfunc__["args"][0]["options"]
    # The arg is converted via the object cache (registered for `object`)...
    assert arg_options["convert"] is object
    # ...while the annotation still carries the real type for static tooling: it resolves
    # to Annotated[pd.DataFrame, ObjectHandle], which type checkers read as pd.DataFrame.
    annotation = view.__annotations__["obj"]
    assert annotation.__args__[0] is pd.DataFrame
    assert xw.ObjectHandle in annotation.__metadata__


def test_bare_object_handle_return_hint_is_alias_for_object():
    # `-> ObjectHandle` is an alias for `-> object`: it converts via the object cache.
    from xlwings.server import func

    @func
    async def make() -> xw.ObjectHandle:
        return pd.DataFrame({"a": [1]})

    assert make.__xlfunc__["ret"]["options"]["convert"] is object


@pytest.mark.anyio
async def test_object_handle_argument_resolves_to_wrapped_object():
    # End-to-end: a function annotated with ObjectHandle[pd.DataFrame] receives the cached
    # DataFrame (not the cache key) in its body.
    from xlwings.server import custom_functions_call, func

    @func
    async def consume(df: xw.ObjectHandle[pd.DataFrame]):
        # If resolution works, `df` is a DataFrame and `.shape` succeeds. Return it as
        # plain values (not an object handle) so we can assert on the result directly.
        return list(df.shape)

    import sys
    import types

    module = types.ModuleType("_oh_test_module")
    module.consume = consume
    sys.modules["_oh_test_module"] = module

    # Write a handle, then call the function with the handle's cache key as its argument.
    _, key = _write(pd.DataFrame({"a": [1, 2, 3]}))
    result = await custom_functions_call(
        {
            "func_name": "consume",
            "args": [[[key]]],
            "version": xw.__version__,
            "client": "Office.js",
            "runtime": "1.4",
        },
        module,
    )
    assert result == [[3, 1]]  # (3 rows, 1 col)
