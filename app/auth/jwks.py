from aiocache import Cache, cached


@cached(ttl=60 * 60 * 24, cache=Cache.MEMORY)
async def get_jwks_json():
    pass
