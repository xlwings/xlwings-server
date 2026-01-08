import logging
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
from xlwings import XlwingsError
from xlwings.constants import ObjectHandleIcons
from xlwings.conversion import Converter

from .config import settings
from .routers import xlwings as xlwings_router
from .serializers import deserialize, serialize

logger = logging.getLogger(__name__)

# Used if XLWINGS_OBJECT_CACHE_URL, i.e., Redis isn't configured.
# Only useful with a single worker e.g., during development.
cache = {}


class ObjectCacheConverter(Converter):
    @staticmethod
    def read_value(cell_address, options):
        # For custom function args of type Entity, the frontend sends the cell address
        # instead of the cell value
        redis_client: redis.Redis = xlwings_router.redis_client_context.get()
        if settings.object_cache_url and not redis_client:
            raise XlwingsError("Failed to connect to Redis")
        key = f"object:{cell_address}"
        if settings.object_cache_url:
            value = redis_client.get(key)
            if not value:
                raise XlwingsError("Object cache is empty")
            if settings.object_cache_enable_compression:
                value = zlib.decompress(value).decode()
            else:
                value = value.decode()
        else:
            value = cache.get(key)
            if not value:
                raise XlwingsError("Object cache is empty")
        obj = deserialize(value)
        return obj

    @staticmethod
    def write_value(obj, options):
        redis_client: redis.Redis = xlwings_router.redis_client_context.get()
        if settings.object_cache_url and not redis_client:
            raise XlwingsError("Failed to connect to Redis")
        key = f"object:{xlwings_router.caller_address_context.get()}"
        values = serialize(obj)
        if settings.object_cache_url:
            expire_at = None
            if settings.object_cache_expire_at:
                cron = croniter(settings.object_cache_expire_at)
                expire_at = int(cron.get_next())
            if settings.object_cache_enable_compression:
                values = zlib.compress(values.encode())
            redis_client.set(key, values, exat=expire_at)
        else:
            logger.warning(
                "Storing objects in memory. Configure XLWINGS_OBJECT_CACHE_URL "
                "for production use!"
            )
            cache[key] = values

        obj_type = type(obj).__name__

        result = {
            "type": "Entity",
            "text": options.get("text", obj_type) or obj_type,
            "properties": {
                "Type": {
                    "type": "String",
                    "basicValue": obj_type,
                },
            },
            "layouts": {
                "compact": {
                    "icon": options.get("icon", ObjectHandleIcons.generic)
                    or ObjectHandleIcons.generic
                }
            },
        }

        # Shape
        def get_shape(obj):
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

        shape_value = get_shape(obj)
        if shape_value:
            result["properties"]["Shape"] = {
                "type": "String",
                "basicValue": shape_value,
            }

        # Columns
        cols_info = None
        if pd and isinstance(obj, pd.DataFrame):
            cols_info = ", ".join(f"{col} [{obj[col].dtype}]" for col in obj.columns)
        if cols_info:
            result["properties"]["Columns"] = {
                "type": "String",
                "basicValue": cols_info,
            }

        # Index
        index_info = None
        if pd and isinstance(obj, pd.DataFrame):
            index_type = type(obj.index).__name__
            index_length = len(obj.index)
            index_start = obj.index[0]
            index_end = obj.index[-1]
            index_info = (
                f"{index_type}: {index_length} entries, {index_start} to {index_end}"
            )
        if index_info:
            result["properties"]["Index"] = {
                "type": "String",
                "basicValue": index_info,
            }
        return result
