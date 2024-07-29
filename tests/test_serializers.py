import datetime as dt

import pandas as pd
from pandas.testing import assert_frame_equal

from app.serializers import deserialize, serialize


def test_serialize():
    assert (
        serialize([1, 1.1, True, False, "test", dt.datetime(2000, 12, 31)])
        == '{"data": [1, 1.1, true, false, "test", "2000-12-31T00:00:00"], "serializer": "default"}'
    )


def test_deserialize():
    assert deserialize(
        '{"data": [1, 1.1, true, false, "test", "2000-12-31T00:00:00"], "serializer": "default"}'
    ) == [1, 1.1, True, False, "test", dt.datetime(2000, 12, 31)]


def test_list():
    data = [1, 1.1, True, False, "test", dt.datetime(2000, 12, 31)]
    assert data == deserialize(serialize(data))


def test_dict():
    data = {
        "one": 1,
        "two": 1.1,
        "three": True,
        "four": False,
        "five": "test",
        "six": dt.datetime(2000, 12, 31),
    }
    assert data == deserialize(serialize(data))


def test_df():
    data = pd.DataFrame({"a": [1, 2], "b": [3, 4]})
    assert_frame_equal(data, deserialize(serialize(data)))
