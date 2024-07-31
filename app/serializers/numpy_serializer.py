import numpy as np
import numpy.typing as npt

from .framework import Serializer


class NumpyArraySerializer(Serializer):
    name = "np.Array"

    @classmethod
    def serialize(cls, arr: npt.NDArray):
        return {
            "serializer": cls.name,
            "data": arr.tolist(),
        }

    @classmethod
    def deserialize(cls, payload):
        arr = np.array(payload["data"])
        return arr


NumpyArraySerializer.register(np.array, np.ndarray)
