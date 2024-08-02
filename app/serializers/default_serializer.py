from .framework import Serializer, convert_iso_strings_to_datetime


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
        return convert_iso_strings_to_datetime(payload["data"])


DefaultSerializer.register()
