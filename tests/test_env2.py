"""
Tests in this module use .env.test and have to be run via:
ENV_FILE=".env.test2" pytest tests/test_env2.py

This allows to test behavior that depends on the settings during loading the app, e.g.,
conditional import statements or conditional dependency injections.
"""

import os

import pytest
import xlwings as xw
from fastapi.testclient import TestClient

from app.main import main_app

client = TestClient(main_app)

if os.getenv("ENV_FILE") != ".env.test2":
    pytest.skip("ENV_FILE is not set", allow_module_level=True)


def test_example_custom_functions_not_available():
    with pytest.raises(AttributeError) as exc_info:
        client.post(
            "/xlwings/custom-functions-call",
            json={
                "func_name": "hello",
                "args": [[["xlwings"]]],
                "caller_address": "Sheet1!B21",
                "content_language": "en-US",
                "version": xw.__version__,
                "runtime": "1.4",
            },
        )
    assert "module 'app.custom_functions' has no attribute 'hello'" in str(
        exc_info.value
    )
