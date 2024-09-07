# Docker Compose

## Prerequisites

- Docker
- Docker Compose

Install them by following the [official docs](https://docs.docker.com/engine/install/#server) under your Linux distribution (for RHEL, follow the CentOS instructions).

If you're in a hurry, you can also use the convenience script provided by Docker:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

Double-check that you can run the following two commands:

```
docker
docker compose
```

If docker compose isn't available, you can install it as [plugin](https://docs.docker.com/compose/install/#scenario-two-install-the-compose-plugin).

## Containers

This setup includes the following containers:

- `nginx`: Reverse proxy and handling of TLS certificates
- `app`: The xlwings server app
- `socketio`: Socket.io service for streaming functions and other realtime functionality
- `redis`: Required for Socket.io and Object handles

## Deployment

- Set the following environment variables either on your VM or in the `.env` file:

  - `XLWINGS_LICENSE_KEY="your_license_key"`
  - `XLWINGS_ENVIRONMENT="prod"`

- Store your TLS certificates in the `certs` folder with the following names:

  - `privkey.pem`
  - `fullchain.pem`

- Whenever there are changes to your source code, in the root directory, run:

  ```
  docker compose -f docker/docker-compose.prod.yaml build
  ```

- To run the app:

  ```
  docker compose -f docker/docker-compose.prod.yaml up -d
  ```

- To tail the logs (exit via `Ctrl-C`):

  ```
  docker compose -f docker/docker-compose.prod.yaml logs -f
  ```

## Minimalistic Setup

If you prefer a much more minimalistic setup with only the xlwings Server app container, you can also run the following instead:

```bash
docker compose -f docker/docker-compose.prod-min.yaml up -d
```

Limitations:

- The minimalistic setup doesn't support streaming functions
- The minimalistic setup requires an external Redis service for object handles via `XLWINGS_OBJECT_CACHE_URL`
