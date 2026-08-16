import dataclasses

import pytest
import xlwings as xw

from xlwings_server.models import Caller, caller_from_address, parse_caller_address


@pytest.mark.parametrize(
    "caller_address, expected",
    [
        ("[Book1.xlsx]Sheet1!B21", ("Book1.xlsx", "Sheet1", "B21")),
        ("Sheet1!B21", ("", "Sheet1", "B21")),
        ("[Book1.xlsx]'My Sheet'!A1", ("Book1.xlsx", "My Sheet", "A1")),
        ("'My Sheet'!A1:C3", ("", "My Sheet", "A1:C3")),
        # Excel escapes a literal apostrophe in a quoted sheet name by doubling it
        ("[My Book.xlsx]'It''s'!$A$1", ("My Book.xlsx", "It's", "$A$1")),
        ("Sheet1!$B$21:$D$25", ("", "Sheet1", "$B$21:$D$25")),
    ],
)
def test_parse_caller_address(caller_address, expected):
    assert parse_caller_address(caller_address) == expected


@pytest.mark.parametrize("caller_address", ["garbage", "", "Sheet1", "!A1"])
def test_parse_caller_address_malformed(caller_address):
    with pytest.raises(xw.XlwingsError):
        parse_caller_address(caller_address)


def test_caller_from_address():
    caller = caller_from_address("[Book1.xlsx]Sheet1!B21")
    assert isinstance(caller, Caller)
    assert caller.address == "$B$21"
    assert caller.row == 21
    assert caller.column == 2
    assert caller.shape == (1, 1)
    assert caller.sheet_name == "Sheet1"
    assert caller.book_name == "Book1.xlsx"


def test_caller_from_address_multi_cell():
    caller = caller_from_address("Sheet1!B21:D25")
    assert caller.address == "$B$21:$D$25"
    assert (caller.row, caller.column) == (21, 2)
    assert caller.shape == (5, 3)


def test_caller_from_address_quoted_sheet():
    assert caller_from_address("[B.xlsx]'My Sheet'!A1").sheet_name == "My Sheet"
    assert caller_from_address("'It''s'!$A$1:$C$3").sheet_name == "It's"


def test_caller_from_address_without_workbook_prefix():
    # Older clients and most of the test suite send a bare Sheet1!B21. Report the missing
    # workbook as "" rather than inventing a plausible-looking name.
    assert caller_from_address("Sheet1!B21").book_name == ""


@pytest.mark.parametrize("caller_address", [None, ""])
def test_caller_from_address_unavailable(caller_address):
    assert caller_from_address(caller_address) is None


@pytest.mark.parametrize("caller_address", [0, [], {}, 5])
def test_caller_from_address_non_string(caller_address):
    # Not "unavailable": caller_address arrives in an untyped dict, so a non-string is
    # malformed input and must surface rather than silently become None.
    with pytest.raises(xw.XlwingsError):
        caller_from_address(caller_address)


@pytest.mark.parametrize(
    "caller_address",
    [
        "Sheet1!A0",  # row 0
        "Sheet1!XFE1",  # past column XFD: col_name() raises IndexError
        "Sheet1!A1048577",  # past the last row
        "Sheet1!B2:A1",  # reversed range
        "Sheet1!A1junk",  # trailing characters
        # A regex anchored with "$" would also match just before a trailing newline, which
        # both bypasses the trailing-character check and puts a newline into the log line.
        "Sheet1!A1\n",
        "Sheet1!A1\r\n",
        "\nSheet1!A1",
        "She\net1!A1",
        "'My\nSheet'!A1",
    ],
)
def test_caller_from_address_invalid_raises_xlwings_error(caller_address):
    # The type matters as much as the raise: xlwings' helpers leak IndexError, which isn't
    # an XlwingsError and would escape the routers' except clause as a 500.
    with pytest.raises(xw.XlwingsError):
        caller_from_address(caller_address)


@pytest.mark.parametrize("caller_address", ["Sheet1!A1", "Sheet1!XFD1048576"])
def test_caller_from_address_boundaries(caller_address):
    """Excel's first and last cell must still parse."""
    assert caller_from_address(caller_address) is not None


def test_caller_is_immutable():
    caller = caller_from_address("Sheet1!B21")
    with pytest.raises(dataclasses.FrozenInstanceError):
        caller.address = "$A$1"


def test_caller_does_not_touch_global_xlwings_state():
    """Callers must not create workbooks in the process-global remote engine.

    An earlier design built a synthetic xw.Book per invocation, which accumulated books
    without bound and reassigned the global active book - a cross-request hazard. This is
    the canary for that regression.
    """
    books = xw.engines["remote"].apps.active.books
    count_before = len(books)
    active_before = books.active

    for caller_address in [
        "[Book1.xlsx]Sheet1!B21",
        "Sheet2!A1:C3",
        "'My Sheet'!$D$4",
    ]:
        caller_from_address(caller_address)

    assert len(books) == count_before
    # Compare by identity: Book.__eq__ only compares app and name, so two distinct books
    # with the same name would compare equal and hide a replaced active book.
    assert books.active.impl is active_before.impl
