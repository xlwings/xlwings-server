"""
This is a sample unit test for a custom function
"""

from xlwings_server.custom_functions.examples import hello


def test_custom_function_hello():
    assert hello("xlwings") == "Hello xlwings!"
