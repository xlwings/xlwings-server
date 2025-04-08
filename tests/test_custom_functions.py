"""
This is a sample unit test for a custom function
"""

from app.custom_functions.examples import hello


def test_custom_function_hello():
    assert hello("xlwings") == "Hello xlwings!"
