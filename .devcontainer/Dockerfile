# Use the base image
FROM mcr.microsoft.com/devcontainers/python:1-3.12-bullseye

# Set the working directory
WORKDIR /workspace

# Install Python dependencies
COPY ./requirements-dev.txt .
RUN pip install -r /workspace/requirements-dev.txt && pip install pre-commit

# Install Node.js from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - \
    && apt-get install -y nodejs

# Install npm dependencies
COPY ./package.json .
COPY ./package-lock.json .
RUN npm install
