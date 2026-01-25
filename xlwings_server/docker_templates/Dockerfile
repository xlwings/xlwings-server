# Dockerfile for xlwings Server
# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:0.9.26-python3.14-trixie-slim

# Setup a non-root user
RUN groupadd --system --gid 999 nonroot \
    && useradd --system --gid 999 --uid 999 --create-home nonroot

# Install the project into `/app`
WORKDIR /app

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Ensure installed tools can be executed out of the box
ENV UV_TOOL_BIN_DIR=/usr/local/bin

# Copy dependency files first for better layer caching
COPY pyproject.toml uv.lock ./

# Install the project's dependencies using the lockfile and settings
RUN uv sync --locked --no-install-project --no-dev

# Then, add the rest of the project source code and install it
# Installing separately from its dependencies allows optimal layer caching
COPY . /app
RUN uv sync --locked --no-dev

# Build static files with hashed filenames for cache-busting
RUN uv run xlwings-server build static

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Python settings
ENV PYTHONUNBUFFERED=1

# Default port and workers
ENV PORT=8000
ENV WORKERS=1
EXPOSE 8000

# Reset the entrypoint, don't invoke `uv`
ENTRYPOINT []

# Use the non-root user to run our application
USER nonroot

# Uses shell to set PORT and WORKERS, then exec for proper signal handling
CMD ["sh", "-c", "\
    exec uvicorn \
    --host 0.0.0.0 \
    --port $PORT \
    --workers $WORKERS \
    --access-log \
    xlwings_server.main:main_app \
    "]
