from .framework import Serializer, custom_decoder


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
        return custom_decoder(payload["data"])


DefaultSerializer.register()
