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
    assert exclusions["calcCompare"] is True
    # Derived properties are present.
    assert set(entity["properties"]) >= {"Type", "Shape", "Columns", "Index"}


def test_roundtrip_resolves_same_object():
    df = pd.DataFrame({"a": [1, 2]})
    _, key = _write(df)
    assert Converter.read_value(key, {}).equals(df)


def test_read_value_raises_on_cache_miss():
    with pytest.raises(xw.ObjectCacheMissError) as excinfo:
        Converter.read_value(str(uuid.uuid4()), {})
    assert excinfo.value.key is not None


def test_read_value_rejects_foreign_entity():
    with pytest.raises(xw.XlwingsError):
        Converter.read_value({oh.NOT_A_HANDLE_MARKER: True}, {})


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
    # The wrapped object (not the wrapper) is what gets cached.
    assert Converter.read_value(key, {}).equals(df)


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


def test_stale_object_handle_text_is_platform_aware():
    web = oh.stale_object_handle(client="Office.js")
    desktop = oh.stale_object_handle(client="VBA")
    assert web["text"] == "#STALE!"
    assert "recalculate" in web["properties"]["Status"]["basicValue"]
    assert "Ctrl+Alt+F9" in desktop["properties"]["Status"]["basicValue"]
