import datetime as dt

import numpy as np
import pandas as pd
import pytest
from numpy.testing import assert_array_equal
from pandas.testing import assert_frame_equal, assert_series_equal

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
    data = pd.DataFrame(
        {
            "ints": [1, 2],
            "b": ["a", "b"],
            "date time": [
                dt.datetime(2022, 12, 1, 10, 33),
                dt.datetime(2022, 12, 2, 10, 34),
            ],
            "bool": [True, False],
            "floats": [1.1, 2.2],
        }
    )
    assert_frame_equal(data, deserialize(serialize(data)))


@pytest.mark.parametrize(
    "test_input",
    [
        pd.Series(
            [
                dt.datetime(2022, 12, 1, 10, 33),
                dt.datetime(2022, 12, 2, 10, 34),
            ]
        ),
        pd.Series([1.5, 2.5, 3.5]),
        pd.Series([1, 2, 3]),
        pd.Series(["a", "b", "c"]),
        pd.Series([True, False, True]),
    ],
)
def test_series(test_input):
    assert_series_equal(test_input, deserialize(serialize(test_input)))


def test_numpy():
    data = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    assert_array_equal(data, deserialize(serialize(data)))


def test_dict_of_df():
    df1 = pd.DataFrame(
        {
            "ints": [1, 2],
            "b": ["a", "b"],
            "date time": [
                dt.datetime(2022, 12, 1, 10, 33),
                dt.datetime(2022, 12, 2, 10, 34),
            ],
            "bool": [True, False],
            "floats": [1.1, 2.2],
        }
    )
    df2 = pd.DataFrame(
        {
            "ints": [11, 22],
            "b": ["a", "b"],
            "date time": [
                dt.datetime(2022, 12, 1, 10, 33),
                dt.datetime(2022, 12, 2, 10, 34),
            ],
            "bool": [True, False],
            "floats": [1.1, 2.2],
        }
    )
    data = {"df1": df1, "df2": df2}
    data2 = deserialize(serialize(data))
    assert_frame_equal(data["df1"], data2["df1"])
    assert_frame_equal(data["df2"], data2["df2"])


def test_dict_of_ndarray():
    arr1 = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    arr2 = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    data1 = {"arr1": arr1, "arr2": arr2}
    data2 = deserialize(serialize(data1))
    assert_array_equal(data1["arr1"], data2["arr1"])
    assert_array_equal(data1["arr1"], data2["arr2"])


def test_list_of_ndarray():
    arr1 = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    arr2 = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    data1 = [arr1, arr2]
    data2 = deserialize(serialize(data1))
    assert_array_equal(data1[0], data2[0])
    assert_array_equal(data1[1], data2[1])


def test_tuple_of_ndarray():
    arr1 = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    arr2 = np.array([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]])
    data1 = (arr1, arr2)
    data2 = deserialize(serialize(data1))
    assert_array_equal(data1[0], data2[0])
    assert_array_equal(data1[1], data2[1])
