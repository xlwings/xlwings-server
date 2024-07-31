import logging
import zlib

import redis
from croniter import croniter
from xlwings import XlwingsError
from xlwings.conversion import Converter

from .config import settings
from .routers import xlwings as xlwings_router
from .serializers import deserialize, serialize

# TODOs
# use unload js event to clear cache?
# allow to clear the cache manually
# numpy serializer
# make redis package optional
# xlwings.view()
logger = logging.getLogger(__name__)

# Used if Redis isn't configured. Only useful for 1-worker setups like dev.
cache = {}


class ObjectCacheConverter(Converter):
    @staticmethod
    def read_value(cell_address, options):
        # For custom function args of type Entity, the frontend sends the cell address
        # instead of the cell value
        redis_client: redis.Redis = xlwings_router.redis_client_context.get()
        if settings.cache_url and not redis_client:
            raise XlwingsError("Failed to connect to Redis")
        key = f"object:{cell_address}"
        if settings.cache_url:
            value = redis_client.get(key)
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
        if settings.cache_url and not redis_client:
            raise XlwingsError("Failed to connect to Redis")
        key = f"object:{xlwings_router.caller_address_context.get()}"
        values = serialize(obj)
        if settings.cache_url:
            expire_at = None
            if settings.object_cache_expire_at:
                cron = croniter(settings.object_cache_expire_at)
                expire_at = int(cron.get_next())
            if settings.object_cache_enable_compression:
                values = zlib.compress(values.encode())
            redis_client.set(key, values, exat=expire_at)
        else:
            logger.info(
                "Storing objects in memory. Configure `XLWINGS_CACHE_URL` for production use!"
            )
            cache[key] = values
        return {
            "type": "Entity",
            "text": options.get("display_name", obj.__class__.__name__),
            "properties": {"length": {"type": "String", "basicValue": str(len(obj))}},
            "layouts": {"compact": {"icon": options.get("icon", "Generic")}},
        }
