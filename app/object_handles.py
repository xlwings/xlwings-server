from xlwings import XlwingsError
from xlwings.conversion import Converter

from .config import settings

# TODOs
# scope cache key to user? use Excel.Setting to store a UUID instead of workbook name?
# allow to clear the cache manually / via expireat / when workbook is closed
# compression?
from .routers import xlwings as xlwings_router
from .serializers import deserialize, serialize

# Used if Redis isn't configured. Only useful for 1-worker setups like dev.
cache = {}


class ObjectCacheConverter(Converter):
    @staticmethod
    def read_value(cell_address, options):
        # For custom function args of type Entity, the frontend sends the cell address
        # instead of the cell value
        redis_client = xlwings_router.redis_client_context.get()
        if settings.cache_url and not redis_client:
            raise XlwingsError("Failed to connect to Redis")
        if settings.cache_url:
            value = redis_client.get(cell_address).decode()
        else:
            value = cache.get(cell_address)
        if not value:
            raise XlwingsError("Object cache is empty")
        obj = deserialize(value)
        return obj

    @staticmethod
    def write_value(obj, options):
        redis_client = xlwings_router.redis_client_context.get()
        if settings.cache_url and not redis_client:
            raise XlwingsError("Failed to connect to Redis")
        key = xlwings_router.caller_address_context.get()
        values = serialize(obj)
        if settings.cache_url:
            redis_client.set(key, values)
        else:
            cache[key] = values
        return {
            "type": "Entity",
            "text": options.get("display_name", obj.__class__.__name__),
            "properties": {"length": {"type": "String", "basicValue": str(len(obj))}},
            "layouts": {"compact": {"icon": options.get("icon", "Generic")}},
        }
