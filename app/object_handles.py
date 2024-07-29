from xlwings import XlwingsError
from xlwings.conversion import Converter

from .config import settings

# TODOs
# Refactor so you can provide own serializer/deserializer
# missing cache error
# scope cache key to user? use Excel.Setting to store a UUID instead of workbook name?
# 1-worker handling in memory?
# allow to clear the cache manually / via expireat / when workbook is closed
# compression?
from .routers import xlwings as xlwings_router
from .serializers import deserialize, serialize


class ObjectCacheConverter(Converter):
    @staticmethod
    def read_value(cell_address, options):
        # For custom function args of type Entity, the frontend sends the cell address
        # instead of the value
        if not settings.cache_url:
            raise XlwingsError(
                "You must provide the 'XLWINGS_CACHE_URL' setting to use the object cache!"
            )
        redis_client = xlwings_router.redis_client_context.get()
        value = redis_client.get(cell_address)
        if not value:
            raise XlwingsError("Object cache is empty")
        obj = deserialize(value.decode())
        return obj

    @staticmethod
    def write_value(obj, options):
        if not settings.cache_url:
            raise XlwingsError(
                "You must provide the 'XLWINGS_CACHE_URL' setting to use the object cache!"
            )
        key = xlwings_router.caller_address_context.get()
        redis_client = xlwings_router.redis_client_context.get()
        values = serialize(obj)
        redis_client.set(key, values)
        return {
            "type": "Entity",
            "text": options.get("display_name", obj.__class__.__name__),
            "properties": {"length": {"type": "String", "basicValue": str(len(obj))}},
            "layouts": {"compact": {"icon": options.get("icon", "Generic")}},
        }
