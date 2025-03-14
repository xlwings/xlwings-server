import pytest

from app import models


@pytest.fixture
def user():
    return models.User(
        claims={
            "aud": "13c282a0-c32e-407a-951c-f4430452b8c5",
            "iss": "https://login.microsoftonline.com/a843834f-3a6b-47e1-a703-b8b8176acaf5/v2.0",
            "iat": 1741959456,
            "nbf": 1741959456,
            "exp": 1741967851,
            "aio": "AXQBi/9YBBBBDexKFvjRYSvje1gxW4k/YDZQXBXiXHjHZ3kJxboEGXudbqj33mFDbzvPxsKXW9SnL7GlZJhuWTKSVV1PQXxB29874u7CHN1wMvJzMc4WqKT63jekGx1hTJydN1jtMKQR3Nj8yG0Boi28NBVkM23lx==",
            "azp": "6580bd71-8e07-4046-b2b6-a423ce1a2f33",
            "azpacr": "0",
            "name": "John Doe",
            "oid": "51398f37-bca1-43c0-88bc-4094404112d8",
            "preferred_username": "john@doe.com",
            "rh": "1.AREAO3S5XXcIX029qNS36wDIOy4liEzcjjdPoNWFOYH1Bj0XASkRAA.",
            "roles": ["admin", "user"],
            "scp": "access_as_user",
            "sid": "92682fa6-e04f-4595-ac55-f2b913d7f2ce",
            "sub": "8Jx2YFpT7Dnb4HeLRvG5q9_KzPwVmCSlaA3N1EcBiUo",
            "tid": "735ccef4-ac95-41cb-874a-04eea053ef22",
            "uti": "k7RpX2wsDmQtY5jLfH9vBb",
            "ver": "2.0",
        },
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


def test_user_email_from_claims(user):
    # Should use preferred_username from claims as default
    assert user.email == "john@doe.com"

    # Test with explicitly set email
    user.email = "explicit@example.com"
    assert user.email == "john@doe.com"  # Claims still takes precedence

    # Test when we remove preferred_username from claims
    user_claims = user.claims.copy()
    user_claims.pop("preferred_username")
    user = models.User(email="fallback@example.com", claims=user_claims)
    assert user.email == "fallback@example.com"  # Falls back to email_ field


def test_custom_email_implementation():
    class CustomEmailUser(models.User):
        @property
        def email(self) -> str:
            return "custom@example.com"

    user = CustomEmailUser(id="3", name="Custom Email User")

    assert user.email == "custom@example.com"


def test_user_basic_attributes():
    # Create user with all basic attributes
    user = models.User(
        id="12345",
        name="Jane Smith",
        domain="example.org",
        email="jane@example.org",
        roles=["developer", "tester"],
    )

    # Test properties return the correct values
    assert user.id == "12345"
    assert user.name == "Jane Smith"
    assert user.email == "jane@example.org"
    assert user.domain == "example.org"
    assert user.roles == ["developer", "tester"]

    # Test that attributes can be updated through properties
    user.id = "67890"
    user.name = "Jane Doe"
    user.email = "jane.doe@example.com"
    user.domain = "example.com"
    user.roles = ["manager", "developer"]

    # Verify updates were successful
    assert user.id == "67890"
    assert user.name == "Jane Doe"
    assert user.email == "jane.doe@example.com"
    assert user.domain == "example.com"
    assert user.roles == ["manager", "developer"]


def test_user_id_is_oid(user):
    assert user.id == "51398f37-bca1-43c0-88bc-4094404112d8"


def test_user_name(user):
    assert user.name == "John Doe"


def test_user_domain(user):
    assert user.domain == "doe.com"
