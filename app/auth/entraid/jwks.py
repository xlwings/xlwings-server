from aiocache import Cache, cached


@cached(ttl=60 * 60 * 24, cache=Cache.MEMORY)
async def get_jwks_json():
    """If your application runs on an air-gapped server and can't download the
    Azure JSON Web Key Set (JWKS), you can provide your own function here to access
    the JSON file.
    """
    pass
