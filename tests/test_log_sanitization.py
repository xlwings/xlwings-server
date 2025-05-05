import pytest

from app.routers.xlwings import sanitize_log_input


@pytest.mark.parametrize(
    "test_input, expected_output",
    [
        ("Normal string", "Normal string"),
        ("String with\nnewline", "String with\\nnewline"),
        ("String with\rcarriage return", "String with\\rcarriage return"),
        ("String with\r\nboth", "String with\\r\\nboth"),
        ("String\nwith\rmixed\nchars", "String\\nwith\\rmixed\\nchars"),
        ("", ""),
        ("No special chars here!", "No special chars here!"),
        (123, "123"),
        (None, "None"),
    ],
)
def test_sanitize_log_input(test_input, expected_output):
    """Tests the sanitize_log_input function."""
    assert sanitize_log_input(test_input) == expected_output


def test_sanitize_log_input_non_string():
    """Tests sanitize_log_input with non-string types."""
    assert sanitize_log_input(123) == "123"
    assert sanitize_log_input(None) == "None"
    assert sanitize_log_input(True) == "True"
