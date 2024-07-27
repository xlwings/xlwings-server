import datetime as dt
import json
from io import StringIO

import pandas as pd
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


def custom_encoder(obj):
    if isinstance(obj, dt.datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def convert_iso_strings_to_datetime(obj):
    if isinstance(obj, list):
        return [convert_iso_strings_to_datetime(item) for item in obj]
    elif isinstance(obj, dict):
        return {
            key: convert_iso_strings_to_datetime(value) for key, value in obj.items()
        }
    elif isinstance(obj, str):
        try:
            return dt.datetime.fromisoformat(obj)
        except ValueError:
            return obj
    else:
        return obj


def serialize(obj):
    try:
        data = json.dumps(obj, default=custom_encoder)
    except TypeError:
        if isinstance(obj, pd.DataFrame):
            data = json.dumps(
                {
                    "class": "pd.DataFrame",
                    "data": obj.to_json(date_format="iso"),
                    "dtypes": {col: str(dtype) for col, dtype in obj.dtypes.items()},
                }
            )
        else:
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    return data


def deserialize(data):
    obj = json.loads(data)
    if isinstance(obj, dict) and "class" in obj:
        class_name = obj["class"]
        if class_name == "pd.DataFrame":
            df = pd.read_json(StringIO(obj["data"]))
            dtypes = {
                col: pd.api.types.pandas_dtype(dtype_str)
                for col, dtype_str in obj["dtypes"].items()
            }
            for col, dtype in dtypes.items():
                df[col] = df[col].astype(dtype)
            return df
        else:
            raise ValueError(f"Unknown class for deserialization: {class_name}")
    else:
        return convert_iso_strings_to_datetime(obj)
