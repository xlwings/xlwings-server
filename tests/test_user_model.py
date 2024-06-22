import pytest

from app.auth.models import User


@pytest.fixture
def user():
    return User(
        id="1", name="Test User", email="test@example.com", roles=["admin", "user"]
    )


def test_authorize_no_roles_required(user):
    authorized, message = user.authorize()
    assert authorized is True
    assert message == ""


def test_authorize_with_required_roles(user):
    authorized, message = user.authorize(roles=["admin"])
    assert authorized is True
    assert message == ""


def test_authorize_missing_roles(user):
    authorized, message = user.authorize(roles=["admin", "editor"])
    assert authorized is False
    assert "Auth error: Missing roles for Test User: editor" in message
