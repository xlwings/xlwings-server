import datetime as dt

import numpy as np
import pandas as pd
import pytest

try:
    from app.custom_functions.examples import view
except ImportError:
    view = None


@pytest.mark.skipif(view is None, reason="xlwings Lite")
@pytest.mark.anyio
async def test_view():
    # Test with str
    assert await view("test", head=None) == "test"
    assert await view("test", head=True) == "test"
    assert await view("test", head=3) == "test"

    # Test with float
    assert await view(1.23, head=None) == 1.23
    assert await view(1.23, head=True) == 1.23
    assert await view(1.23, head=3) == 1.23

    # Test with int
    assert await view(123, head=None) == 123
    assert await view(123, head=True) == 123
    assert await view(123, head=3) == 123

    # Test with datetime
    now = dt.datetime.now()
    assert await view(now, head=None) == now
    assert await view(now, head=True) == now
    assert await view(now, head=3) == now

    # Test with list of floats
    lst = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6]
    assert await view(lst, head=None) == lst
    assert await view(lst, head=True) == lst[:5]
    assert await view(lst, head=3) == lst[:3]

    # Test with list of lists with floats
    list2d = [
        [1.1, 2.2],
        [3.3, 4.4],
        [5.5, 6.6],
        [7.7, 8.8],
        [9.9, 10.10],
        [11.11, 12.12],
    ]
    assert await view(list2d, head=None) == list2d
    assert await view(list2d, head=True) == list2d[:5]
    assert await view(list2d, head=3) == list2d[:3]

    # Test with pd.DataFrame
    df = pd.DataFrame({"A": range(10), "B": range(10, 20)})
    pd.testing.assert_frame_equal(await view(df, head=None), df)
    pd.testing.assert_frame_equal(await view(df, head=True), df.iloc[:5, :])
    pd.testing.assert_frame_equal(await view(df, head=3), df.iloc[:3, :])

    # # Test with numpy array
    arr = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    np.testing.assert_array_equal(await view(arr, head=None), arr)
    np.testing.assert_array_equal(await view(arr, head=True), arr[:5])
    np.testing.assert_array_equal(await view(arr, head=3), arr[:3])
