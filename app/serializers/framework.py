# Registry, holding class/serializer_name combinations
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
