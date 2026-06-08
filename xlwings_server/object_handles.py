import logging
import uuid
import zlib

try:
    import numpy as np
except ImportError:
    np = None
try:
    import pandas as pd
except ImportError:
    pd = None
import redis
from croniter import croniter
from xlwings import ObjectCacheMissError, ObjectHandle, XlwingsError
from xlwings.constants import ObjectHandleIcons
from xlwings.conversion import Converter

from .config import settings
from .routers import xlwings as xlwings_router
from .serializers import deserialize, serialize

logger = logging.getLogger(__name__)

# Used if XLWINGS_OBJECT_CACHE_URL, i.e., Redis isn't configured.
# Only useful with a single worker e.g., during development.
cache = {}

# Reserved Entity property that carries the cache key (a UUID). It travels with the Entity
# (so it survives copy/paste and `=A1`) but is hidden from the user via excludeFrom (see
# write_value). User-supplied properties must never overwrite it.
RESERVED_PROPERTY = "object_handle_cache_key"

# Marker the frontend substitutes for an Entity argument that isn't one of our object
# handles (e.g., a Stocks/Geography entity passed by mistake).
NOT_A_HANDLE_MARKER = "__xlwingsNotAHandle"


def _cache_key(cache_id):
    """Builds the cache key for an object handle's UUID. The key is global by default so
    that object handles are portable; with XLWINGS_OBJECT_CACHE_PARTITION_BY_USER it's
    scoped to the user so that one user can't resolve another user's cached object."""
    if settings.object_cache_partition_by_user:
        user_id = xlwings_router.user_id_context.get() or "anonymous"
        return f"object:{user_id}:{cache_id}"
    return f"object:{cache_id}"


def _redis_client():
    redis_client: redis.Redis = xlwings_router.redis_client_context.get()
    if settings.object_cache_url and not redis_client:
        raise XlwingsError("Failed to connect to Redis")
    return redis_client


def _get(key):
    """Reads a serialized object from the cache. Returns None if the key is absent."""
    if settings.object_cache_url:
        value = _redis_client().get(key)
        if value is None:
            return None
        if settings.object_cache_enable_compression:
            value = zlib.decompress(value)
        return value.decode()
    return cache.get(key)


def _set(key, value):
    """Writes a serialized object to the cache, applying the configured expiry."""
    if settings.object_cache_url:
        expire_at = None
        if settings.object_cache_expire_at:
            cron = croniter(settings.object_cache_expire_at)
            expire_at = int(cron.get_next())
        if settings.object_cache_enable_compression:
            value = zlib.compress(value.encode())
        _redis_client().set(key, value, exat=expire_at)
    else:
        logger.warning(
            "Storing objects in memory. Configure XLWINGS_OBJECT_CACHE_URL "
            "for production use!"
        )
        cache[key] = value


def _derived_properties(obj):
    """Returns the automatically derived Entity properties (type, shape, columns, index)
    for the given object. User-supplied properties from ObjectHandle are merged on top."""
    properties = {
        "Type": {"type": "String", "basicValue": type(obj).__name__},
    }

    # Shape
    shape_value = _get_shape(obj)
    if shape_value:
        properties["Shape"] = {"type": "String", "basicValue": shape_value}

    # Columns
    if pd and isinstance(obj, pd.DataFrame):
        cols_info = ", ".join(f"{col} [{obj[col].dtype}]" for col in obj.columns)
        properties["Columns"] = {"type": "String", "basicValue": cols_info}

    # Index
    if pd and isinstance(obj, pd.DataFrame):
        index_type = type(obj.index).__name__
        index_length = len(obj.index)
        index_start = obj.index[0]
        index_end = obj.index[-1]
        index_info = (
            f"{index_type}: {index_length} entries, {index_start} to {index_end}"
        )
        properties["Index"] = {"type": "String", "basicValue": index_info}

    return properties


def _get_shape(obj):
    if pd and isinstance(obj, pd.DataFrame):
        return f"{obj.shape}"
    if np and isinstance(obj, np.ndarray):
        return f"{obj.shape}"
    elif isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (list, tuple)):
            return f"({len(obj)}, {len(obj[0])})"
        return f"({len(obj)},)"
    else:
        try:
            return f"{len(obj)} (length)"
        except Exception:
            return None


def stale_object_handle(client=None):
    """Builds the Entity shown when a consumed object handle is no longer cached. It stays
    an Entity (rather than an error) so downstream cards still render and the user sees an
    actionable message. There's no refresh button (Excel entity cards can't host one), so
    the user recalculates to regenerate the object."""
    # Ctrl+Alt+F9 isn't available on Excel on the web.
    if client == "Office.js":
        hint = "recalculate the source cell"
    else:
        hint = "press Ctrl+Alt+F9 to refresh"
    icon = ObjectHandleIcons.alert
    if isinstance(icon, ObjectHandleIcons):
        icon = icon.value
    entity = {
        "type": "Entity",
        "text": "Expired object",
        "properties": {
            "Status": {
                "type": "String",
                "basicValue": f"This object is no longer cached. Please {hint}.",
            },
        },
        "layouts": {"compact": {"icon": icon}},
    }
    # Custom function results must be a 2D array. The normal return path goes through
    # conversion.write(), which wraps the entity in [[...]]; the stale path bypasses that
    # (it's returned directly by the router), so wrap it here. Without this, Excel receives
    # a scalar where it expects a grid and renders the cell as a #VALUE! error.
    return [[entity]]


class ObjectCacheConverter(Converter):
    @staticmethod
    def read_value(value, options):
        # For custom function args of type Entity, the frontend sends the object handle's
        # cache key (a UUID) instead of the cell value.
        if isinstance(value, dict) and value.get(NOT_A_HANDLE_MARKER):
            raise XlwingsError("Argument is not an xlwings object handle")
        key = _cache_key(value)
        payload = _get(key)
        if payload is None:
            # Object expired or evicted. Raised so it can be turned into a stale object
            # handle centrally (see routers.xlwings) instead of poisoning the function.
            raise ObjectCacheMissError(key)
        return deserialize(payload)

    @staticmethod
    def write_value(obj, options):
        # Allow customizing text/icon/properties per object via xw.ObjectHandle.
        text = options.get("text")
        icon = options.get("icon")
        user_properties = {}
        if isinstance(obj, ObjectHandle):
            text = obj.text or text
            icon = obj.icon or icon
            user_properties = obj.properties
            obj = obj.obj

        if RESERVED_PROPERTY in user_properties:
            raise XlwingsError(
                f"'{RESERVED_PROPERTY}' is a reserved object handle property name"
            )

        cache_id = str(uuid.uuid4())
        _set(_cache_key(cache_id), serialize(obj))

        obj_type = type(obj).__name__
        icon = icon or ObjectHandleIcons.generic
        if isinstance(icon, ObjectHandleIcons):
            icon = icon.value

        properties = _derived_properties(obj)
        # User-supplied properties win over the derived ones.
        properties.update(user_properties)
        # The reserved cache key is written last so it can never be shadowed. `excludeFrom`
        # keeps it out of the card and formulas while it still persists on the Entity (and
        # so survives copy/paste and `=A1`): cardView hides it from the card, autoComplete
        # from formula suggestions, dotNotation from FIELDVALUE(), and calcCompare from
        # recalc change-detection (the UUID changes on every recalc).
        properties[RESERVED_PROPERTY] = {
            "type": "String",
            "basicValue": cache_id,
            "propertyMetadata": {
                "excludeFrom": {
                    "cardView": True,
                    "autoComplete": True,
                    "dotNotation": True,
                    "calcCompare": True,
                },
            },
        }

        return {
            "type": "Entity",
            "text": text or obj_type,
            "properties": properties,
            "layouts": {"compact": {"icon": icon}},
        }
