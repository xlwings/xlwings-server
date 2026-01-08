from .framework import Serializer, custom_decoder


class DictionarySerializer(Serializer):
    name = "custom_dict_serializer"

    @classmethod
    def serialize(cls, obj):
        # Convert dictionary with non-string keys (e.g., datetime) to a list of
        # [key, value] pairs
        items = [[k, v] for k, v in obj.items()]
        return {
            "data": items,
            "serializer": cls.name,
        }

    @classmethod
    def deserialize(cls, payload):
        # Convert back from list of pairs to dictionary
        items = payload["data"]
        return {custom_decoder(k): custom_decoder(v) for k, v in items}


# Register the serializer for dict type
DictionarySerializer.register(dict)
