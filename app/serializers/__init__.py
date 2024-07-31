import json

from . import default_serializer, numpy_serializer, pandas_serializer
from .framework import Serializer, serializers
from .helpers import datetime_encoder


def serialize(obj, serializer_name="default"):
    serializer = serializers.get(type(obj), serializers.get(serializer_name))
    if serializer is None:
        raise ValueError(f"No serializer registered for object of type {type(obj)}")
    return json.dumps(serializer.serialize(obj), default=datetime_encoder)


def deserialize(payload, serializer_name="default"):
    payload = json.loads(payload)
    serializer_name = payload.get("serializer", serializer_name)
    serializer = serializers.get(serializer_name, serializers.get(serializer_name))
    if serializer is None:
        raise ValueError(f"No serializer registered with name '{serializer_name}'")
    return serializer.deserialize(payload)
