import uuid
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
            serialized = {"serializer": cls.name}

            if isinstance(df.index, pd.MultiIndex):
                df = df.copy()
                index_names = df.index.names
                # Index names are often None
                temp_names = [
                    f"_idx_{uuid.uuid4().hex[:8]}" for _ in range(len(df.index.names))
                ]
                index_mapping = {
                    temp: orig for temp, orig in zip(temp_names, index_names)
                }
                df.index.names = temp_names
                df = df.reset_index()
                serialized.update(
                    {
                        "is_multi_index": True,
                        "index_mapping": index_mapping,
                    }
                )

            serialized.update(
                {
                    "serializer": cls.name,
                    "data": df.to_json(date_format="iso"),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                }
            )

            # Preserve DatetimeIndex frequency if it exists
            if isinstance(df.index, pd.DatetimeIndex) and df.index.freq is not None:
                serialized["index_freq"] = df.index.freq.freqstr

            return serialized

        @classmethod
        def deserialize(cls, payload):
            df = pd.read_json(StringIO(payload["data"]))

            # Standard column type conversion
            for col, dtype in payload["dtypes"].items():
                df[col] = df[col].astype(dtype)

            # Handle MultiIndex reconstruction
            if payload.get("is_multi_index"):
                index_mapping = payload["index_mapping"]
                # Convert temporary columns back to index with original names
                index_cols = list(index_mapping.keys())
                df = df.set_index(index_cols)
                # Restore original index names
                df.index.names = list(index_mapping.values())

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
