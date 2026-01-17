"""Build-time utilities for xlwings Server.

This package contains tools used during build and deployment processes,
such as static file hashing for cache-busting.
"""

from .static_file_hasher import StaticFileHasher

__all__ = ["StaticFileHasher"]
