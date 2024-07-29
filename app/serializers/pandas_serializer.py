from io import StringIO

import pandas as pd

from .framework import Serializer


class PandasDataFrameSerializer(Serializer):
    name = "pd.DataFrame"

    @classmethod
    def serialize(cls, df):
        return {
            "serializer": cls.name,
            "data": df.to_json(date_format="iso"),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        }

    @classmethod
    def deserialize(cls, payload):
        df = pd.read_json(StringIO(payload["data"]))
        for col, dtype in payload["dtypes"].items():
            df[col] = df[col].astype(dtype)
        return df


PandasDataFrameSerializer.register(pd.DataFrame)
