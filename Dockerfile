FROM python:3.12-slim

# Makes sure that logs are shown immediately
ENV PYTHONUNBUFFERED=1

COPY ./requirements.in ./project/requirements.in
COPY ./requirements.txt ./project/requirements.txt

RUN pip install --no-cache-dir -r /project/requirements.txt

COPY ./app /project/app

EXPOSE 8000

WORKDIR /project

# This is for a simple 1-worker-setup that handles both socket.io and
# FastAPI traffic. Normally, you split them up so that you can scale
# up the FastAPI workers.
# NOTE: If you run this Dockerfile via "docker compose up", CMD will be overridden
# by docker-compose.yaml
CMD ["gunicorn", "app.main:sio_app", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--workers", "1", \
     "--worker-class", "uvicorn.workers.UvicornWorker"]
