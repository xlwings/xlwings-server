import redis  # TODO: import redis.asyncio as redis

from .config import settings

redis_pool = None
if settings.object_cache_url:
    redis_pool = redis.ConnectionPool.from_url(settings.object_cache_url)


def get_redis_client():
    if redis_pool is None:
        yield None
    else:
        client = redis.Redis.from_pool(redis_pool)
        try:
            yield client
        finally:
            client.close()
