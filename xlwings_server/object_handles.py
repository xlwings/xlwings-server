"""Redis backend for xlwings object handles.

The converter, the default in-process LRU store, and the stale-handle card live in
xlwings core (xlwings.pro.object_handles); this module plugs in the Redis-backed store
when XLWINGS_OBJECT_CACHE_URL is configured. Serialization, compression, expiry, and
per-user key partitioning are backend concerns and therefore live here, inside the store.
"""

import logging
import zlib

import redis
from croniter import croniter
from xlwings import XlwingsError
from xlwings.pro import object_handles as core_object_handles

# Re-exports for the rest of the app (main.py, routers, tests).
from xlwings.pro.object_handles import (  # noqa: F401
    NOT_A_HANDLE_MARKER,
    RESERVED_PROPERTY,
    LRUObjectCache,
    ObjectCacheConverter,
    stale_object_handle,
)

from .config import settings
from .routers import xlwings as xlwings_router
from .serializers import deserialize, serialize

logger = logging.getLogger(__name__)


class XlwingsOperationalError(XlwingsError):
    """A transient/operational failure (e.g. the object cache backend is unreachable), as
    opposed to a deterministic client error. The API maps it to a 5xx so that custom
    functions retry it (see custom_functions_retry_codes), unlike a plain XlwingsError."""


class RedisObjectCache:
    """Redis-backed object store. Objects are serialized (and optionally compressed),
    keys carry the configured expiry, and with XLWINGS_OBJECT_CACHE_PARTITION_BY_USER
    they're scoped to the user."""

    @staticmethod
    def _key(cache_id):
        """Builds the Redis key for an object handle's UUID. The key is global by default
        so that object handles are portable; with XLWINGS_OBJECT_CACHE_PARTITION_BY_USER
        it's scoped to the user so that one user can't resolve another user's cached
        object."""
        if settings.object_cache_partition_by_user:
            user_id = xlwings_router.user_id_context.get()
            if not user_id:
                # Partitioning is an isolation control: without a user to scope to, we'd
                # silently bucket everyone together and give a false sense of isolation.
                # Fail loudly instead so the misconfiguration (e.g. partitioning on
                # without auth) is surfaced rather than papered over.
                raise XlwingsError(
                    "XLWINGS_OBJECT_CACHE_PARTITION_BY_USER requires an authenticated "
                    "user"
                )
            return f"object:{user_id}:{cache_id}"
        return f"object:{cache_id}"

    @staticmethod
    def _client():
        redis_client: redis.Redis = xlwings_router.redis_client_context.get()
        if not redis_client:
            raise XlwingsOperationalError("Failed to connect to Redis")
        return redis_client

    def get(self, cache_id):
        value = self._client().get(self._key(cache_id))
        if value is None:
            return None
        if settings.object_cache_enable_compression:
            value = zlib.decompress(value)
        return deserialize(value.decode())

    def set(self, cache_id, obj):
        value = serialize(obj)
        expire_at = None
        if settings.object_cache_expire_at:
            cron = croniter(settings.object_cache_expire_at)
            expire_at = int(cron.get_next())
        if settings.object_cache_enable_compression:
            value = zlib.compress(value.encode())
        self._client().set(self._key(cache_id), value, exat=expire_at)

    def clear(self):
        redis_client = self._client()
        for key in redis_client.scan_iter(match="object:*"):
            redis_client.delete(key)


class _WarningLRUObjectCache(LRUObjectCache):
    """Core's default in-memory store, but warning on every write: in-memory objects are
    lost on restart and not shared across workers, so production should use Redis."""

    def set(self, cache_id, obj):
        # Write first so the logged utilization includes this entry. A count pinned at
        # maxsize/maxsize means evictions are happening: raise
        # XLWINGS_OBJECT_CACHE_MAXSIZE or configure Redis.
        super().set(cache_id, obj)
        logger.warning(
            f"Storing objects in memory ({len(self)}/{self.maxsize}). "
            "Configure XLWINGS_OBJECT_CACHE_URL for production use!"
        )


# Install the store matching the configuration. The converter (in xlwings core) looks up
# this attribute at call time.
core_object_handles.cache = (
    RedisObjectCache()
    if settings.object_cache_url
    else _WarningLRUObjectCache(maxsize=settings.object_cache_maxsize)
)
