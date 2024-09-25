import datetime as dt

# Registry, holding type or serializer_name vs. serializer combinations
serializers = {}


# Base class
class Serializer:
    @classmethod
    def serialize(cls, obj):
        raise NotImplementedError()

    @classmethod
    def deserialize(cls, payload):
        raise NotImplementedError()

    @classmethod
    def register(cls, *types):
        serializers[cls.name] = cls
        for type in types:
            serializers[type] = cls


# Custom encoders/decoders
def custom_encoder(obj):
    if isinstance(obj, dt.datetime):
        return obj.isoformat()
    valid_types = tuple(cls for cls in serializers.keys() if isinstance(cls, type))
    if isinstance(obj, valid_types):
        serializer = serializers.get(type(obj))
        if serializer:
            return serializer.serialize(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def custom_decoder(obj):
    if isinstance(obj, list):
        return [custom_decoder(item) for item in obj]
    elif isinstance(obj, dict):
        serializer = serializers.get(obj.get("serializer"))
        if serializer:
            return serializer.deserialize(obj)
        return {key: custom_decoder(value) for key, value in obj.items()}
    elif isinstance(obj, str):
        try:
            return dt.datetime.fromisoformat(obj)
        except ValueError:
            return obj
    else:
        return obj
