# Troubleshooting

## Invalid session

You get websocket/socket.io connection errors in the browser dev tools along with something like the following on the server logs:

```none
Invalid session nms2Du11Yi15GwE2AAAA (further occurrences of this error will be logged with level INFO)
```

You're most likely running your Socket.io service with multiple workers. This can happen if you set the `XLWINGS_ENVIRONMENT=dev` but are running multiple gunicorn or uvicorn workers. You have to run the Socket.io service with exactly 1 worker, see [`docker/docker-compose.prod.yaml`](https://github.com/xlwings/xlwings-server/blob/main/docker/docker-compose.prod.yaml) for an example production setup.

## Error installing add-ins

When installing the Office.js add-in, you get the following error in the taskbar of Excel: "Addin xlwings Server failed to download a required resource".

Make sure to run your server via https, not via http by using TLS certificates. This also means that you will need to use a domain name, not the IP address directly.
