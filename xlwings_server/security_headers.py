"""OWASP-recommended security headers, hardcoded.

Based on the OWASP Secure Headers Project:
- https://owasp.org/www-project-secure-headers/index.html#configuration-proposal
- https://owasp.org/www-project-secure-headers/ci/headers_add.json

The following headers from the OWASP proposal are intentionally NOT applied:
- ``Permissions-Policy``: experimental
- ``Clear-Site-Data``: too aggressive
- ``Content-Security-Policy``: provide via ``XLWINGS_CUSTOM_HEADERS`` instead

``BASE_HEADERS`` is the default set. Certain deployments need a few of these
relaxed; those variations are expressed as override sets that are layered on
top of the base set by ``resolve_security_headers``. In an override set, a
value of ``None`` means "remove this header".
"""

# last update from OWASP source: 2024-09-02 21:54:45 UTC
BASE_HEADERS: dict[str, str] = {
    "Cache-Control": "no-store, max-age=0",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "deny",
    "X-Permitted-Cross-Domain-Policies": "none",
}

# Excel on the web loads the add-in cross-origin, embeds it in a frame, and
# opens dialogs (Office.context.ui.displayDialogAsync with displayInIframe),
# so it needs a less restrictive isolation policy.
EXCEL_ONLINE_OVERRIDES: dict[str, str | None] = {
    "Cross-Origin-Resource-Policy": "cross-origin",
    # remove: any COOP value can place the dialog in a separate browsing-context
    # group and sever Office's parent<->dialog messaging bridge, closing it
    "Cross-Origin-Opener-Policy": None,
    "X-Frame-Options": None,  # remove: the add-in is framed by Office
    # NOTE: COEP (require-corp, from BASE_HEADERS) is intentionally kept. It is
    # compatible with the default (vendored, same-origin) office.js. If you set
    # XLWINGS_CDN_OFFICEJS=true, the CDN office.js is cross-origin and COEP is
    # dropped by CDN_OFFICEJS_OVERRIDES below.
}

# Public add-in store (XLWINGS_CDN_OFFICEJS): serving Office.js from the CDN is
# incompatible with COEP: require-corp, so that header must be dropped.
CDN_OFFICEJS_OVERRIDES: dict[str, str | None] = {
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cross-Origin-Embedder-Policy": None,  # remove: incompatible with the CDN
}


def resolve_security_headers(
    *, excel_online: bool, cdn_officejs: bool
) -> dict[str, str]:
    """Return the header set for the given deployment, base + overrides.

    Overrides are layered in order; a ``None`` value removes the header.
    """
    headers: dict[str, str | None] = dict(BASE_HEADERS)
    if excel_online:
        headers |= EXCEL_ONLINE_OVERRIDES
    if cdn_officejs:
        headers |= CDN_OFFICEJS_OVERRIDES
    return {name: value for name, value in headers.items() if value is not None}
