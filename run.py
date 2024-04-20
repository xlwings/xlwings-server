import os

import uvicorn

is_cloud = os.getenv("CODESPACES") or os.getenv("GITPOD_WORKSPACE_ID")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:sio_app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        ssl_keyfile="certs/localhost+2-key.pem" if not is_cloud else None,
        ssl_certfile="certs/localhost+2.pem" if not is_cloud else None,
    )
