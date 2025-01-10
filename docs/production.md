# Production Checklist

Before deploying to production, there's a few things that you should check for security, performance, and branding reasons.

## Taskpane

Replace the [example task pane](https://github.com/xlwings/xlwings-server/blob/main/app/templates/examples/hello_world/taskpane_hello.html) with your own. If you don't have any meaningful content, just leave it empty by providing the following:

<!-- prettier-ignore-->
```html
{% extends "base.html" %}

{% block content %}
  <div class="container-fluid pt-3 ps-3">
    <h1>Name of your Add-in</h1>
  </div>
{% endblock content %}
```

Store this under `app/templates/taskpane.html` and update the `name` argument under [`app/routers/taskpane.py`](https://github.com/xlwings/xlwings-server/blob/main/app/routers/taskpane.py) to `"taskpane.html"`.

## Settings

- Make sure that the environment is set to `"prod"`. This disables hotreload and will prevent unhandled exceptions to be shown in Excel. `xlwings.XlwingsError` continue to be shown:

  ```ini
  XLWINGS_ENVIRONMENT="prod"
  ```

- Manifest: replace all xlwings references & icons with your own name & icons. Currently, you'll need to do this both in [`app/templates/manifest.xml`](https://github.com/xlwings/xlwings-server/blob/main/app/templates/manifest.xml) as well as in a few settings:

  ```ini
  XLWINGS_FUNCTIONS_NAMESPACE="YOUR_NAME"
  XLWINGS_PROJECT_NAME="Your Name"
  ```

- Disable all libraries that you don't use. Candidates are:

  ```ini
  XLWINGS_ENABLE_ALPINEJS_CSP=false
  XLWINGS_ENABLE_HTMX=false
  XLWINGS_ENABLE_SOCKETIO=false
  XLWINGS_ENABLE_BOOTSTRAP=false
  ```

- Disable the examples:

  ```ini
  XLWINGS_ENABLE_EXAMPLES=false
  ```

- If you want to publish the add-in to the public Excel add-in store ("App Source"), you need to set this to `true`. This will load the Office.js JS library from Microsoft's CDN as required by Microsoft:

  ```ini
  XLWINGS_CDN_OFFICEJS=true
  ```

- Make sure that the log level is not on `"DEBUG"` as this can log sensitive tokens:

  ```ini
  XLWINGS_LOG_LEVEL="INFO"
  ```

- Unless you have good reasons not to, enable the HTTP security response headers via:

  ```ini
  XLWINGS_ADD_SECURITY_HEADERS=true
  ```

- Enable authentication if appropriate, e.g., when using Microsoft Entra ID:

  ```ini
  XLWINGS_AUTH_PROVIDERS=["entraid"]
  ```

- Configure CORS properly. If you don't use the Office Scripts integration and don't use custom functions in Excel on the web, disable CORS:

  ```ini
  XLWINGS_CORS_ALLOW_ORIGINS=""
  ```

  If you use custom functions with Excel on the web, configure CORS as follows:

  ```ini
  XLWINGS_CORS_ALLOW_ORIGINS=["your.domain.com"]
  ```

  If you use Office Scripts as your integration, you currently need to allow all origins:

  ```ini
  XLWINGS_CORS_ALLOW_ORIGINS=["*"]
  ```

- If you don't use Excel on the web, set this to `false` to get more restrictive HTTP security response headers:

  ```ini
  XLWINGS_ENABLE_EXCEL_ONLINE=false
  ```

## License key

When trying out xlwings, you should set your trial key as `XLWINGS_LICENSE_KEY`. Once you enroll in a paid plan, you can either use your developer license key directly or create a deploy key first.

- **Developer key**: this is the key that you will be provided with after purchase. Developer keys are valid for one or more developers (depending on your plan) and expire after 1 year, which means you'll have to update the license key each year.

- **Deploy key**: A deploy key doesn’t expire but is bound to a specific version of xlwings, which means that you need to generate a new deploy key every time you update xlwings. Note that you can’t generate deploy keys with a trial license.

If you have your developer license key set as `XLWINGS_DEVELOPER_KEY` env var in your build environment, it will install the deploy key directly in the Docker image when building the docker file with the following `--build-arg`:

```text
docker build --build-arg XLWINGS_DEVELOPER_KEY=${XLWINGS_DEVELOPER_KEY} .
```

If you want to create a deploy key manually, you fist need to activate your developer license like this:

```text
xlwings license update -k YOUR_LICENSE_KEY
```

Then you can generate deploy keys (make sure that the xlwings version is the same as the one used in production):

```text
xlwings license deploy
```

```{note}
xlwings licenses keys are verified offline (i.e., no telemetry/license server involved).
```

## Workers

```{note}
If you are using serverless functions such as Azure functions or AWS Lambda, you don't need to care about the number of workers, as these platforms handle this dynamically based on the number of incoming requests.
```

With `XLWINGS_ENVIRONMENT="dev"`, you're running a single worker, i.e., process. To take advantage of multiple CPU cores and to be able to serve more traffic, you want to run multiple workers in production. If you have long running functions that are CPU-bound, multiple workers will also mean that the app won't get blocked for everyone while such a long running function is processing.

Each worker runs an own instance of the xlwings Server app, and so with each additional worker, your memory requirements will increase. The exact number of workers depends on the amount of your traffic and the nature of your functions. [Gunicorn](https://gunicorn.org/), which is the HTTP server recommended for production, suggests a maximum of 2-4 workers per CPU-core. A pragmatic way of finding the right amount of workers is to start with a low number, say 2-4, then increase the number of workers up to a maximum of 4 workers per core if your users encounter performance issues.

You can have a look at [`docker-compose.prod.yaml`](https://github.com/xlwings/xlwings-server/blob/main/deployment/docker-compose.prod.yaml) to see the gunicorn command with the `workers` argument:

```text
gunicorn app.main:main_app
--bind 0.0.0.0:8000
--access-logfile -
--workers 2
--timeout 30
--worker-class uvicorn.workers.UvicornWorker
```

Container-based platforms such as Kubernetes or Render.com allow you to scale the number of containers instead of the number of workers inside the container. Both options should work equally well, but for low traffic applications, scaling the number of containers on platforms such as Render.com will be much more expensive.

## Redis

If you are using one of the following features, you need to use a [Redis](https://redis.io/) database or a compatible service such as [Valkey](https://valkey.io/).

- [Streaming functions](custom_functions.md#streaming-functions-rtd-functions): Redis connects the [app workers](#workers) with the [Socket.io](#socketio) service via its pub-sub functionality. To use Redis, provide the following setting (for more info, see `.env` file):

  ```ini
  XLWINGS_SOCKETIO_MESSAGE_QUEUE_URL=...
  ```

- [Object handles](custom_functions.md#object-handles): Redis acts as an object cache that is shared across all [app workers](#workers). To use Redis, provide the following setting (for more info, see `.env` file):

  ```ini
  XLWINGS_OBJECT_CACHE_URL=...
  ```

You can install Redis, make it part of your Docker compose stack, or use a hosted service. For reference, see [`docker-compose.prod.yaml`](https://github.com/xlwings/xlwings-server/blob/main/deployment/docker-compose.prod.yaml).

## Socket.io

In production, Socket.io is only required for [Streaming functions](custom_functions.md#streaming-functions-rtd-functions) and the experimental `utils.trigger_script()`. You may also decide to use Socket.io for realtime functionality in your task pane.

Since Socket.io is a stateful protocol, you must run it with exactly 1 worker. This means that you have to run it as a separate process, which connects to the [app workers](#workers) via [](#redis). Even if you are running it with only 1 worker, it can scale to thousands of concurrent connections.

However, to avoid blocking Python's event loop, the Socket.io server shouldn't manage any long-running tasks, such as slow, CPU-bound functions. Often, this isn't an issue as streaming functions are primarily used to stream data from external services (e.g., market data). As long as you can query these external services via an async HTTP request or similar (e.g., using `httpx` or `aiohttp`), you're good!

```{note}
Even if you don't use Socket.io in production, you should leave `XLWINGS_ENABLE_SOCKETIO=true` for your development environment as there, it's responsible for hot-reloading the Office.js frontend code with every code change.
```

## Timeout

Under normal circumstances, HTTP requests time out if they do not receive a response within a certain time frame. When deploying xlwings Server, you usually have to deal with a timeout on two levels:

- **gunicorn**: gunicorn serves the Python app and has a default timeout of 30 seconds. If you want to increase it to e.g., 60 seconds, provide the option `--timeout 60` in the gunicorn command, see e.g., [deployment/docker-compose.prod.yaml](https://github.com/xlwings/xlwings-server/blob/main/deployment/docker-compose.prod.yaml).
- **Reverse proxy/load balancer**: in front of gunicorn, you usually have a reverse proxy, such as nginx. For Kubernetes or fully managed solutions like Azure functions, you usually deal with a load balancer. They all have their own timeouts, so you might need to adjust it for it to be at least as long as the gunicorn timeout. For example, for nginx, the default timeout is 60 seconds and can be adjusted using the `proxy_read_timeout 60s;` directive.

## HTTP caching

Often, HTTP servers such as nginx or Cloudflare will add caching headers to the static files served. This means that when you deploy a new version of your server, users may still use the previous version of that file. To prevent this:

Run `python scripts/build_static_files.py` as part of your deployment process. This will add content hashes to the file names and will therefore bust the caching when the content changes. Note that this is already done in the `Dockerfile`.

This, however, will have no effect on files requested by the `manifest.xml`, which is especially critical for xlwings Lite, where every file is a static file. For xlwings Lite deployments, make sure that the following files don't allow caching by adding the the `Cache-Control: public, max-age=0, must-revalidate` header:

```
- .../xlwings/custom-functions-code.js
- .../xlwings/custom-functions-meta.json
- .../xlwings/taskpane.html
```

When you host your xlwings Lite app on Cloudflare Pages, you can achieve this by going to `Your Domain` > `Caching` > `Configuration` > `Browser Cache TTL` setting to `Respect Existing Headers`. You also have to include a file called `_headers` in the root of your deployed directory with the following content:

```
/xlwings/custom-functions-code.js
  Cache-Control: public, max-age=0, must-revalidate

/xlwings/custom-functions-meta.json
  Cache-Control: public, max-age=0, must-revalidate
```

```{note}
The image URLs in the `manifest.xml` (for the icons) must not prevent caching, as on Windows, caching is required to properly display the icons in the ribbon. This means that when you need to change the icons, you will need to release a new version of `manifest.xml` with changed URLs to your icons.
```
