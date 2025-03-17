from io import StringIO

try:
    import pandas as pd
except ImportError:
    pd = None

from .framework import Serializer

if pd:

    class PandasDataFrameSerializer(Serializer):
        name = "pd.DataFrame"

        @classmethod
        def serialize(cls, df):
            serialized = {
                "serializer": cls.name,
                "data": df.to_json(date_format="iso"),
                "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            }

            # Preserve DatetimeIndex frequency if it exists
            if isinstance(df.index, pd.DatetimeIndex) and df.index.freq is not None:
                serialized["index_freq"] = df.index.freq.freqstr

            return serialized

        @classmethod
        def deserialize(cls, payload):
            df = pd.read_json(StringIO(payload["data"]))
            for col, dtype in payload["dtypes"].items():
                df[col] = df[col].astype(dtype)

            # Restore DatetimeIndex frequency if it was saved
            if isinstance(df.index, pd.DatetimeIndex) and "index_freq" in payload:
                df.index.freq = pd.tseries.frequencies.to_offset(payload["index_freq"])

            return df

    PandasDataFrameSerializer.register(pd.DataFrame)

    class PandasSeriesSerializer(Serializer):
        name = "pd.Series"

        @classmethod
        def serialize(cls, series):
            return {
                "serializer": cls.name,
                "data": series.to_json(date_format="iso"),
                "dtype": str(series.dtype),
            }

        @classmethod
        def deserialize(cls, payload):
            series = pd.read_json(StringIO(payload["data"]), typ="series")
            series = series.astype(payload["dtype"])
            return series

    PandasSeriesSerializer.register(pd.Series)
