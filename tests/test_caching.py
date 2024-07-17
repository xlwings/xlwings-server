import json

import pytest

from app.caching import CustomSerializer
from app.models import User


@pytest.fixture
def user():
    return User(
        id="1", name="Test User", email="test@example.com", roles=["admin", "user"]
    )


@pytest.fixture
def serializer():
    return CustomSerializer()


def test_dumps_with_user_object(serializer, user):
    user_json = serializer.dumps(user)
    assert json.loads(user_json) == user.to_dict()


def test_dumps_with_non_user_object(serializer):
    data = {"key": "value"}
    data_json = serializer.dumps(data)
    assert json.loads(data_json) == data


@pytest.mark.parametrize(
    "user_data",
    [
        {
            "id": "1",
            "name": "Test User",
            "email": "test@example.com",
            "domain": "example.com",
            "roles": ["admin", "user"],
        },
        {"not_a_user": True},
    ],
)
def test_loads_with_user_data(serializer, user_data):
    user_json = json.dumps(user_data)
    result = serializer.loads(user_json)
    if "id" in user_data:
        assert isinstance(result, User)
        assert result.to_dict() == user_data
    else:
        assert result == user_data


def test_loads_with_none(serializer):
    assert serializer.loads(None) is None


def test_loads_with_invalid_json(serializer):
    invalid_json = "not a valid json"
    assert serializer.loads(invalid_json) == invalid_json
