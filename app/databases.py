import redis  # TODO: use redis.asyncio when converters can be used async

from .config import settings

# Redis
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
