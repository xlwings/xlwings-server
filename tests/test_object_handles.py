"""
Tests for the server-specific parts of object handles: the Redis-backed store
(serialization, compression, user partitioning) and the HTTP status-code mapping of the
error types. The converter itself and the default in-process LRU store are tested in
xlwings core (tests/test_object_handles.py there).
"""

import uuid

import pandas as pd
import pytest
import xlwings as xw
from xlwings.pro import object_handles as core_oh

from xlwings_server import object_handles as oh
from xlwings_server.config import settings
from xlwings_server.routers import xlwings as xlwings_router

Converter = oh.ObjectCacheConverter

# The object-handle example functions (get_df, view, ...) are only registered when Wasm is
# disabled, so route-level tests that call them must be skipped under Wasm.
requires_examples = pytest.mark.skipif(
    settings.enable_wasm,
    reason="object-handle example functions are not registered when Wasm is enabled",
)


class FakeRedis:
    """Minimal stand-in for redis.Redis: just enough for RedisObjectCache (get/set with
    exat) and clear (scan_iter/delete). Values are stored as bytes, like real Redis
    returns them."""

    def __init__(self):
        self.store = {}
        self.expirations = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, exat=None):
        self.store[key] = value.encode() if isinstance(value, str) else value
        if exat is not None:
            self.expirations[key] = exat

    def scan_iter(self, match):
        prefix = match.rstrip("*")
        return [k for k in self.store if k.startswith(prefix)]

    def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture(autouse=True)
def _cache_context():
    # Redis-backed store with a fake client in the contextvar, clean contextvars per
    # test. Register the converter as main.py does, so resolution via conversion.read()
    # works.
    Converter.register(*core_oh.CONVERTER_KEYS)
    original_cache = core_oh.cache
    core_oh.cache = oh.RedisObjectCache()
    # Reset the ContextVars in teardown: redis_client_context has no default, so a
    # leaked FakeRedis would mask missing-context bugs (LookupError) in later modules.
    redis_token = xlwings_router.redis_client_context.set(FakeRedis())
    user_token = xlwings_router.user_id_context.set(None)
    yield
    xlwings_router.redis_client_context.reset(redis_token)
    xlwings_router.user_id_context.reset(user_token)
    core_oh.cache = original_cache


def _write(obj, options=None):
    """Writes an object handle and returns (entity, cache_key)."""
    entity = Converter.write_value(obj, options or {})
    key = entity["properties"][oh.RESERVED_PROPERTY]["basicValue"]
    return entity, key


def test_roundtrip_serializes_through_redis():
    df = pd.DataFrame({"a": [1, 2]})
    _, key = _write(df)
    resolved = Converter.read_value(key, {})
    # Unlike the in-process store, Redis holds a serialized copy, not the same object.
    assert resolved is not df
    assert resolved.equals(df)


def test_roundtrip_with_compression(mocker):
    mocker.patch.object(settings, "object_cache_enable_compression", True)
    df = pd.DataFrame({"a": [1, 2]})
    _, key = _write(df)
    assert Converter.read_value(key, {}).equals(df)


def test_expiry_is_applied_from_cron(mocker):
    mocker.patch.object(settings, "object_cache_expire_at", "0 0 * * *")
    _, key = _write(pd.DataFrame({"a": [1]}))
    fake_redis = xlwings_router.redis_client_context.get()
    assert fake_redis.expirations[f"object:{key}"] > 0


def test_read_value_raises_on_cache_miss():
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(str(uuid.uuid4()), {})


def test_missing_redis_client_is_operational_error():
    # No client in the contextvar (e.g. Redis down at connect time) must surface as the
    # transient/operational error so it maps to a retryable 5xx, not a client error.
    xlwings_router.redis_client_context.set(None)
    with pytest.raises(oh.XlwingsOperationalError):
        _write(pd.DataFrame({"a": [1]}))


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
        _write(pd.DataFrame({"a": [1]}))


def test_clear_deletes_only_object_keys():
    _, key = _write(pd.DataFrame({"a": [1]}))
    fake_redis = xlwings_router.redis_client_context.get()
    fake_redis.store["unrelated"] = b"keep me"
    core_oh.cache.clear()
    assert f"object:{key}" not in fake_redis.store
    assert "unrelated" in fake_redis.store
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(key, {})


def test_delete_removes_single_entry():
    # Superseded-generation cleanup (core's evict_superseded) deletes one key without
    # touching other live handles.
    _, key1 = _write(pd.DataFrame({"a": [1]}))
    _, key2 = _write(pd.DataFrame({"b": [2]}))
    core_oh.cache.delete(key1)
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(key1, {})
    assert Converter.read_value(key2, {}) is not None


def test_producer_map_lives_in_redis():
    # The superseded-generation map is stored in Redis (not in-process), so the
    # recalculation can be handled by a different worker than the one that wrote the
    # previous generation. Core's evict_superseded delegates to the store.
    addr = "Excel[Book1.xlsx]Sheet1!A1"
    entity1, key1 = _write(pd.DataFrame({"a": [1]}))
    core_oh.evict_superseded(addr, [[entity1]], user_id="user_a")

    fake_redis = xlwings_router.redis_client_context.get()
    map_key = f"object:producer:user_a:{addr}"
    assert fake_redis.store[map_key].decode() == key1
    # Core's in-process map stays unused.
    assert not core_oh._producer_cache_ids

    entity2, key2 = _write(pd.DataFrame({"a": [2]}))
    core_oh.evict_superseded(addr, [[entity2]], user_id="user_a")
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(key1, {})
    assert Converter.read_value(key2, {}) is not None


def test_anonymous_sessions_do_not_evict_each_other():
    # Auth disabled: every user is "n/a", and two users can each have their own
    # "workbook1.xlsx" with a handle in A1. The frontend's per-runtime session id keeps
    # their producer map entries apart, so neither recalculation deletes the other's
    # live object.
    addr = "Excel[workbook1.xlsx]Sheet1!A1"
    df_a = pd.DataFrame({"a": [1]})
    entity_a, key_a = _write(df_a)
    core_oh.evict_superseded(addr, [[entity_a]], user_id="n/a", session_id="sess_a")
    df_b = pd.DataFrame({"b": [2]})
    entity_b, key_b = _write(df_b)
    core_oh.evict_superseded(addr, [[entity_b]], user_id="n/a", session_id="sess_b")

    assert Converter.read_value(key_a, {}).equals(df_a)
    assert Converter.read_value(key_b, {}).equals(df_b)


def test_producer_map_is_cleared_with_the_objects():
    # clear() wipes everything under "object:*", which includes the producer map keys -
    # no dangling pointers to deleted objects.
    addr = "Excel[Book1.xlsx]Sheet1!A1"
    entity, _ = _write(pd.DataFrame({"a": [1]}))
    core_oh.evict_superseded(addr, [[entity]], user_id="user_a")
    core_oh.cache.clear()
    fake_redis = xlwings_router.redis_client_context.get()
    assert not [k for k in fake_redis.store if k.startswith("object:")]


def test_non_handle_result_removes_producer_map_entry():
    # A cell that no longer returns a handle deletes its old entry and its map key.
    addr = "Excel[Book1.xlsx]Sheet1!A1"
    entity, key = _write(pd.DataFrame({"a": [1]}))
    core_oh.evict_superseded(addr, [[entity]], user_id="user_a")
    core_oh.evict_superseded(addr, [["plain value"]], user_id="user_a")

    fake_redis = xlwings_router.redis_client_context.get()
    assert f"object:producer:user_a:{addr}" not in fake_redis.store
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(key, {})


def test_in_memory_fallback_is_lru(mocker):
    # Without XLWINGS_OBJECT_CACHE_URL, the active store is core's LRU cache (with the
    # production warning) - bounded, holding raw objects.
    core_oh.cache = oh._WarningLRUObjectCache(maxsize=1)
    _, key1 = _write(pd.DataFrame({"a": [1]}))
    _, key2 = _write(pd.DataFrame({"a": [2]}))
    with pytest.raises(xw.ObjectCacheMissError):
        Converter.read_value(key1, {})
    assert Converter.read_value(key2, {})["a"].tolist() == [2]


@requires_examples
def test_not_a_handle_error_is_not_retryable():
    # End-to-end through the route: a foreign-entity marker must surface as a deliberate
    # client error whose status code is NOT in the retry codes, so custom functions don't
    # retry a deterministic failure.
    from fastapi.testclient import TestClient

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


@requires_examples
def test_cache_backend_unreachable_is_retryable():
    # A transient operational failure (cache backend down) must return a retryable status,
    # unlike the deterministic client errors above. The fixture installed the Redis store;
    # clearing the client contextvar simulates Redis being unreachable when get_df writes.
    from fastapi.testclient import TestClient

    from xlwings_server.main import main_app

    xlwings_router.redis_client_context.set(None)
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
