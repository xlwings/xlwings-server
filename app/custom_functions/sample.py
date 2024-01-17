from xlwings import server


@server.func
def hello(name):
    return f"Hello {name}!"
