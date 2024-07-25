"""
Usage:

from caching import cache

await cache.set("key", "value")
await cache.get("key")

Decorator usage:

from caching import cached

@cached(alias="default", ttl=60 * 60)
@server.func
async def hello(name):
    pass
"""

import json
from urllib.parse import urlparse

from aiocache import RedisCache, SimpleMemoryCache, cached, caches  # noqa: F401
from aiocache.serializers import JsonSerializer

from .config import settings
from .models import User


class CustomSerializer(JsonSerializer):
    def dumps(self, obj):
        if isinstance(obj, User):
            obj = obj.to_dict()
        return json.dumps(obj)

    def loads(self, obj):
        if obj is None:
            return None
        try:
            data = json.loads(obj)
            if data is None:
                return None
            if (
                "id" in data
                and "name" in data
                and "email" in data
                and "domain" in data
                and "roles" in data
            ):
                return User.from_dict(data)
            return data
        except json.JSONDecodeError:
            return obj


if settings.cache_url:
    parsed_url = urlparse(settings.cache_url)
    endpoint = parsed_url.hostname
    port = parsed_url.port
    db = parsed_url.path.lstrip("/")
else:
    endpoint = None
    port = None
    db = None

memory = {
    "cache": SimpleMemoryCache,
    "serializer": {"class": CustomSerializer},
}

redis = {
    "cache": RedisCache,
    "endpoint": endpoint,
    "port": port,
    "db": db,
    "serializer": {"class": CustomSerializer},
}

caches.set_config({"default": redis if settings.cache_url else memory})
cache = caches.get("default")
