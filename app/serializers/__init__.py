import json

from . import default_serializer, pandas_serializer
from .framework import Serializer, serializers
from .helpers import datetime_encoder


def serialize(obj, serializer=None):
    serializer = serializers.get(type(obj), serializer)
    if serializer is None:
        raise ValueError(f"No serializer registered for object of type {type(obj)}")
    return json.dumps(serializer.serialize(obj), default=datetime_encoder)


def deserialize(payload, serializer=None):
    payload = json.loads(payload)
    serializer_name = payload.get("serializer")
    serializer = serializers.get(serializer_name, serializer)
    if serializer is None:
        raise ValueError(f"No serializer registered with name '{serializer_name}'")
    return serializer.deserialize(payload)
