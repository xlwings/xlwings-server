try:
    import numpy as np
except ImportError:
    np = None

from .framework import Serializer

if np:

    class NumpyArraySerializer(Serializer):
        name = "np.array"

        @classmethod
        def serialize(cls, arr: np.ndarray):
            return {
                "serializer": cls.name,
                "data": arr.tolist(),
                "dtype": str(arr.dtype),
            }

        @classmethod
        def deserialize(cls, payload):
            arr = np.array(payload["data"], dtype=payload["dtype"])
            return arr

    NumpyArraySerializer.register(np.array, np.ndarray)
