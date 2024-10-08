# BASE STAGE
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim AS base
WORKDIR /project

# Makes sure that logs are shown immediately
ENV PYTHONUNBUFFERED=1

RUN pip install --upgrade pip

# DEV STAGE
FROM base AS dev
COPY ./scripts/start.sh ./scripts/start.sh
COPY ./requirements-dev.txt ./requirements-dev.txt
RUN pip install --no-cache-dir -r ./requirements-dev.txt

# PROD STAGE
FROM base AS prod
COPY ./requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

# If you have your developer license key set as `XLWINGS_DEVELOPER_KEY` env var in your
# build environment, it will install the deploy key directly in the Docker image when
# running `docker build --build-arg XLWINGS_DEVELOPER_KEY=${XLWINGS_DEVELOPER_KEY} .`.
# This will happen automatically when running `docker compose build`.
ARG XLWINGS_DEVELOPER_KEY
ENV XLWINGS_DEVELOPER_KEY=${XLWINGS_DEVELOPER_KEY-}
RUN xlwings license update -k $(xlwings license deploy) || true

COPY ./scripts/build_static_files.py ./scripts/build_static_files.py
COPY ./app /project/app

RUN python ./scripts/build_static_files.py

EXPOSE 8000

# This is for a simple 1-worker-setup that handles both socket.io and
# FastAPI traffic. Normally, you split them up so that you can scale
# up the FastAPI workers.
CMD ["sh", "-c", \
     "gunicorn app.main:main_app \
     --bind 0.0.0.0:${PORT:-8000} \
     --timeout 30 \
     --access-logfile - \
     --workers 1 \
     --worker-class uvicorn.workers.UvicornWorker"]
