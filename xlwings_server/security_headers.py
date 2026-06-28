"""OWASP-recommended security headers, hardcoded.

Based on the OWASP Secure Headers Project:
- https://owasp.org/www-project-secure-headers/index.html#configuration-proposal
- https://owasp.org/www-project-secure-headers/ci/headers_add.json

The following headers from the OWASP proposal are intentionally NOT applied
(see ``add_security_headers`` in ``main.py``):
- ``Permissions-Policy``: experimental
- ``Clear-Site-Data``: too aggressive
- ``Content-Security-Policy``: provide via ``XLWINGS_CUSTOM_HEADERS`` instead
"""

# last update from OWASP source: 2024-09-02 21:54:45 UTC
SECURITY_HEADERS: dict[str, str] = {
    "Cache-Control": "no-store, max-age=0",
    "Cross-Origin-Embedder-Policy": "require-corp",
    # same-origin-allow-popups (not same-origin) so dialog pop-ups can be
    # opened in Excel on the web
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "deny",
    "X-Permitted-Cross-Domain-Policies": "none",
}
