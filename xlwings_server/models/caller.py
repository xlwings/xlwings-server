"""The cell that called a custom function, delivered via the Caller type hint.

Excel sends the calling cell as an address string (e.g. "[Book1.xlsx]Sheet1!B21"), not as
workbook data: a custom function receives its arguments and nothing else. Caller therefore
models the *reference* only - it deliberately isn't an xw.Range, which would advertise cell
values, reads and writes that this transport can't back. Use xw.WithScript to run a custom
script when you need to touch the workbook itself.
"""

import dataclasses
import re

import xlwings as xw
from xlwings.constants import MAX_COLUMNS, MAX_ROWS
from xlwings.server import register_injectable_typehint
from xlwings.utils import a1_to_tuples, col_name

# [Book1.xlsx]Sheet1!B21 | Sheet1!B21 | [Book1.xlsx]'My Sheet'!A1 | 'It''s'!$A$1:$C$3
# The workbook prefix is optional: Office.js always sends it, but older clients don't.
# A quoted sheet name escapes a literal apostrophe by doubling it.
# Both regexes are applied with fullmatch(): "$" would also match just before a trailing
# newline, which would let "Sheet1!A1\n" through.
_CALLER_ADDRESS_RE = re.compile(
    r"(?:\[(?P<book>[^\]\n\r]*)\])?"
    r"(?:'(?P<quoted_sheet>(?:[^'\n\r]|'')*)'|(?P<sheet>[^'\n\r]*?))"
    r"!(?P<address>[^!\n\r]+)"
)

# a1_to_tuples() accepts anything its regex matches and ignores the rest, so "A1junk"
# silently becomes A1. Match the address strictly and reject leftovers ourselves.
_A1_RE = re.compile(r"\$?[A-Z]{1,3}\$?[0-9]{1,7}(?::\$?[A-Z]{1,3}\$?[0-9]{1,7})?", re.I)


@dataclasses.dataclass(frozen=True)
class Caller:
    """The cell that called a custom function.

    Carries the reference only - there are no cell values here, as custom functions never
    receive the workbook. Excel can't always supply an address (e.g. for streaming
    functions), so the injected value is `Caller | None`.
    """

    address: str
    """Normalized absolute A1 notation, e.g. "$B$21" or "$B$21:$D$25"."""

    row: int
    """1-based row of the top-left cell."""

    column: int
    """1-based column of the top-left cell."""

    shape: tuple[int, int]
    """(rows, columns) of the calling range."""

    sheet_name: str
    """Name of the sheet holding the calling cell."""

    book_name: str
    """Name of the workbook, or "" if the client didn't send one."""


def parse_caller_address(caller_address: str) -> tuple[str, str, str]:
    """Split "[Book1.xlsx]'My Sheet'!$A$1:$C$3" into (book_name, sheet_name, address).

    The workbook name is "" when the client doesn't send the optional prefix.
    """
    if not isinstance(caller_address, str):
        raise xw.XlwingsError(f"Invalid caller address: {caller_address!r}")
    match = _CALLER_ADDRESS_RE.fullmatch(caller_address)
    if not match:
        raise xw.XlwingsError(f"Invalid caller address: '{caller_address}'")
    quoted_sheet = match.group("quoted_sheet")
    if quoted_sheet is not None:
        sheet_name = quoted_sheet.replace("''", "'")
    else:
        sheet_name = match.group("sheet")
    if not sheet_name:
        raise xw.XlwingsError(f"Invalid caller address: '{caller_address}'")
    return match.group("book") or "", sheet_name, match.group("address")


def caller_from_address(caller_address: str | None) -> Caller | None:
    """Build a Caller from the address Excel sent, or None if it didn't send one.

    Returns None only for None and "", the two ways a client signals "no address".
    Anything else that doesn't parse into a valid Excel reference raises an XlwingsError,
    so that malformed input surfaces in the logs rather than being mistaken for absence.
    """
    if caller_address is None or caller_address == "":
        return None
    book_name, sheet_name, address = parse_caller_address(caller_address)
    if not _A1_RE.fullmatch(address):
        raise xw.XlwingsError(f"Invalid caller address: '{caller_address}'")
    try:
        first, last = a1_to_tuples(address.replace("$", "").upper())
    except (IndexError, TypeError, ValueError) as e:
        raise xw.XlwingsError(f"Invalid caller address: '{caller_address}'") from e
    if first is None:
        raise xw.XlwingsError(f"Invalid caller address: '{caller_address}'")
    row, column = first
    last_row, last_column = last if last else first
    # a1_to_tuples() doesn't range-check, so "A0" and "XFE1" get this far. Validate before
    # col_name(), which raises IndexError (not an XlwingsError) beyond column XFD.
    if not (1 <= row <= last_row <= MAX_ROWS):
        raise xw.XlwingsError(f"Caller address is out of range: '{caller_address}'")
    if not (1 <= column <= last_column <= MAX_COLUMNS):
        raise xw.XlwingsError(f"Caller address is out of range: '{caller_address}'")
    try:
        normalized = f"${col_name(column)}${row}"
        if last:
            normalized += f":${col_name(last_column)}${last_row}"
    except (IndexError, TypeError, ValueError) as e:
        raise xw.XlwingsError(f"Invalid caller address: '{caller_address}'") from e
    return Caller(
        address=normalized,
        row=row,
        column=column,
        shape=(last_row - row + 1, last_column - column + 1),
        sheet_name=sheet_name,
        book_name=book_name,
    )


# Tell xlwings that Caller is provided by the framework rather than by Excel, so that it's
# hidden from the Excel-facing signature and can be placed in any position, including
# keyword-only, i.e. after *args. Registered in the defining module so that importing
# Caller from anywhere can't bypass it.
register_injectable_typehint(Caller)
