#!/bin/sh

CMD="uvicorn app.main:main_app --host 0.0.0.0 --port 8000 --reload --reload-dir /project/app"

if [ -f /project/certs/localhost+2-key.pem ] && [ -f /project/certs/localhost+2.pem ]; then
  CMD="$CMD --ssl-keyfile /project/certs/localhost+2-key.pem --ssl-certfile /project/certs/localhost+2.pem"
fi

exec $CMD
