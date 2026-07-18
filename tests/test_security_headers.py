import pytest

from xlwings_server.security_headers import (
    BASE_HEADERS,
    CDN_OFFICEJS_OVERRIDES,
    EXCEL_ONLINE_OVERRIDES,
    resolve_security_headers,
)


def test_default_returns_base_headers():
    """No flags => the base set, unchanged."""
    headers = resolve_security_headers(excel_online=False, cdn_officejs=False)
    assert headers == BASE_HEADERS


def test_default_does_not_mutate_base_headers():
    """Resolving must not mutate the module-level BASE_HEADERS dict."""
    before = dict(BASE_HEADERS)
    resolve_security_headers(excel_online=True, cdn_officejs=True)
    assert BASE_HEADERS == before


def test_excel_online_overrides():
    headers = resolve_security_headers(excel_online=True, cdn_officejs=False)

    # Relaxed for Excel on the web
    assert headers["Cross-Origin-Resource-Policy"] == "cross-origin"
    # COOP is dropped entirely: any value can sever Office's dialog messaging
    assert "Cross-Origin-Opener-Policy" not in headers
    # Removed so the add-in can be framed by Office
    assert "X-Frame-Options" not in headers
    # A base header that Excel Online doesn't touch is preserved
    assert headers["X-Content-Type-Options"] == "nosniff"
    # COEP is kept for Excel Online: compatible with the vendored office.js.
    # It is only dropped by the CDN flag (cross-origin office.js).
    assert headers["Cross-Origin-Embedder-Policy"] == "require-corp"


def test_cdn_officejs_overrides():
    headers = resolve_security_headers(excel_online=False, cdn_officejs=True)

    assert headers["Cross-Origin-Resource-Policy"] == "cross-origin"
    # Incompatible with serving Office.js from the CDN => removed
    assert "Cross-Origin-Embedder-Policy" not in headers
    # CDN flag alone leaves opener policy and framing at the base values
    assert headers["Cross-Origin-Opener-Policy"] == "same-origin"
    assert headers["X-Frame-Options"] == "deny"


def test_both_flags_combine_overrides():
    headers = resolve_security_headers(excel_online=True, cdn_officejs=True)

    # Shared override: CORP relaxed by either flag
    assert headers["Cross-Origin-Resource-Policy"] == "cross-origin"
    # Excel Online contributions
    assert "Cross-Origin-Opener-Policy" not in headers
    assert "X-Frame-Options" not in headers
    # CDN override is layered last, so its COEP removal wins over the
    # require-corp that Excel-Online-alone would keep (cross-origin CDN office.js)
    assert "Cross-Origin-Embedder-Policy" not in headers


def test_none_valued_overrides_remove_headers():
    """Any override whose value is None must not appear in the result."""
    headers = resolve_security_headers(excel_online=True, cdn_officejs=True)
    removed = {
        name
        for name, value in {**EXCEL_ONLINE_OVERRIDES, **CDN_OFFICEJS_OVERRIDES}.items()
        if value is None
    }
    assert removed  # guard: the test is meaningless if nothing is removed
    assert removed.isdisjoint(headers)


def test_result_has_no_none_values():
    """The resolved mapping is dict[str, str] -- never a None value."""
    for excel_online in (False, True):
        for cdn_officejs in (False, True):
            headers = resolve_security_headers(
                excel_online=excel_online, cdn_officejs=cdn_officejs
            )
            assert all(value is not None for value in headers.values())


@pytest.mark.parametrize("excel_online", [False, True])
@pytest.mark.parametrize("cdn_officejs", [False, True])
def test_all_flag_combinations_are_str_to_str(excel_online, cdn_officejs):
    headers = resolve_security_headers(
        excel_online=excel_online, cdn_officejs=cdn_officejs
    )
    assert all(
        isinstance(name, str) and isinstance(value, str)
        for name, value in headers.items()
    )
