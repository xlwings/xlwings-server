import pytest

from app import models


@pytest.fixture
def user():
    return models.User(
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


@pytest.mark.anyio
async def test_custom_roles_implementation():
    class CustomRolesUser(models.User):
        @property
        def roles(self) -> list[str]:
            # Directly return custom roles without using a separate attribute
            return ["custom_role", "another_role"]

    user = CustomRolesUser(id="2", name="Custom Roles User")

    # Verify custom roles are returned
    assert user.roles == ["custom_role", "another_role"]

    # Test authorization with custom roles
    authorized = await user.has_required_roles(required_roles=["custom_role"])
    assert authorized is True

    authorized = await user.has_required_roles(required_roles=["admin"])
    assert authorized is False
