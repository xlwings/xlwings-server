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
def datetime_encoder(obj):
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
