import pytest

from app.auth.models import User


@pytest.fixture
def user():
    return User(
        id="1", name="Test User", email="test@example.com", roles=["admin", "user"]
    )


@pytest.mark.anyio
async def test_check_required_roles_no_roles_required(user):
    authorized = await user.has_required_roles()
    assert authorized is True


@pytest.mark.anyio
async def test_check_required_roles_with_required_roles(user):
    authorized = await user.has_required_roles(required_roles=["admin"])
    assert authorized is True


@pytest.mark.anyio
async def test_check_required_roles_missing_roles(user):
    authorized = await user.has_required_roles(required_roles=["admin", "editor"])
    assert authorized is False
