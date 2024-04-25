FROM python:3.12-slim

WORKDIR /project

# Makes sure that logs are shown immediately
ENV PYTHONUNBUFFERED=1

COPY ./requirements.in ./requirements.in
COPY ./requirements.txt ./requirements.txt
COPY ./scripts/build_static_files.py ./scripts/build_static_files.py

RUN pip install --no-cache-dir -r ./requirements.txt

COPY ./app /project/app
RUN python ./scripts/build_static_files.py


EXPOSE 8000


# This is for a simple 1-worker-setup that handles both socket.io and
# FastAPI traffic. Normally, you split them up so that you can scale
# up the FastAPI workers.
# NOTE: If you run this Dockerfile via "docker compose up", CMD will be overridden
# by docker-compose.yaml
CMD ["gunicorn", "app.main:main_app", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--workers", "1", \
     "--worker-class", "uvicorn.workers.UvicornWorker"]
