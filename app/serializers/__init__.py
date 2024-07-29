import datetime as dt
import json
from io import StringIO

import pandas as pd

serializers = {}


class Serializer:
    def serialize(self, obj):
        raise NotImplementedError()

    def deserialize(self, payload):
        raise NotImplementedError()

    @classmethod
    def register(cls, *types):
        serializers[cls.name] = cls
        for type in types:
            serializers[type] = cls


class PandasDataFrameSerializer(Serializer):
    name = "pd.DataFrame"

    @classmethod
    def serialize(cls, obj):
        return {
            "serializer": cls.name,
            "data": obj.to_json(date_format="iso"),
            "dtypes": {col: str(dtype) for col, dtype in obj.dtypes.items()},
        }

    @classmethod
    def deserialize(cls, payload):
        df = pd.read_json(StringIO(payload["data"]))
        for col, dtype in payload["dtypes"].items():
            df[col] = df[col].astype(dtype)
        return df


PandasDataFrameSerializer.register(pd.DataFrame)


class DefaultSerializer(Serializer):
    name = "default"

    @classmethod
    def serialize(cls, obj):
        return {
            "data": obj,
            "serializer": cls.name,
        }

    @classmethod
    def deserialize(cls, payload):
        return cls.convert_iso_strings_to_datetime(payload["data"])

    @staticmethod
    def custom_encoder(obj):
        if isinstance(obj, dt.datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    @classmethod
    def convert_iso_strings_to_datetime(cls, obj):
        if isinstance(obj, list):
            return [cls.convert_iso_strings_to_datetime(item) for item in obj]
        elif isinstance(obj, dict):
            return {
                key: cls.convert_iso_strings_to_datetime(value)
                for key, value in obj.items()
            }
        elif isinstance(obj, str):
            try:
                return dt.datetime.fromisoformat(obj)
            except ValueError:
                return obj
        else:
            return obj


DefaultSerializer.register(list, dict)


def serialize(obj, serializer=None):
    serializer = serializers.get(type(obj), serializer)
    if serializer is None:
        raise ValueError(f"No serializer registered for object of type {type(obj)}")
    return json.dumps(
        serializer.serialize(obj), default=DefaultSerializer.custom_encoder
    )


def deserialize(payload, serializer=None):
    payload = json.loads(payload)
    serializer_name = payload.get("serializer")
    serializer = serializers.get(serializer_name, serializer)
    if serializer is None:
        raise ValueError(f"No serializer registered with name '{serializer_name}'")
    return serializer.deserialize(payload)
