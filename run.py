import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:cors_app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        ssl_keyfile="certs/localhost+2-key.pem",
        ssl_certfile="certs/localhost+2.pem",
    )
