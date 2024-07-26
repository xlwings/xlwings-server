import datetime as dt
import json
from io import StringIO

import pandas as pd
import redis

r = redis.Redis(host="localhost", port=6379, db=0)


def custom_encoder(obj):
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


def serialize(obj):
    try:
        data = json.dumps(obj, default=custom_encoder)
    except TypeError:
        if isinstance(obj, pd.DataFrame):
            data = json.dumps(
                {
                    "class": "pd.DataFrame",
                    "data": obj.to_json(date_format="iso"),
                    "dtypes": {col: str(dtype) for col, dtype in obj.dtypes.items()},
                }
            )
        else:
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    return data


def deserialize(data):
    obj = json.loads(data)
    if isinstance(obj, dict) and "class" in obj:
        class_name = obj["class"]
        if class_name == "pd.DataFrame":
            df = pd.read_json(StringIO(obj["data"]))
            dtypes = {
                col: pd.api.types.pandas_dtype(dtype_str)
                for col, dtype_str in obj["dtypes"].items()
            }
            for col, dtype in dtypes.items():
                df[col] = df[col].astype(dtype)
            return df
        else:
            raise ValueError(f"Unknown class for deserialization: {class_name}")
    else:
        return convert_iso_strings_to_datetime(obj)


"""
# Example usage
import datetime as dt

# data = pd.DataFrame({'A': [dt.datetime(2000, 12,1, 1, 1), dt.datetime(2000, 12,1), dt.datetime(2000, 12,1)], 'B': [4, 5, 6]})
data = {"a": [1, 2, dt.datetime(2000, 12, 1, 12, 3)]}
serialized_df = serialize(data)
r.set("my_dataframe", serialized_df)

# Retrieve and deserialize
retrieved_data = r.get("my_dataframe").decode()
deserialized_data = deserialize(retrieved_data)
# deserialized_data = convert_iso_strings_to_datetime(deserialized_data)

print(deserialized_data)
"""
