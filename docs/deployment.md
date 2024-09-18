# Deployment Configuration

## Docker images with deploy keys

If you have your developer license key set as `XLWINGS_DEVELOPER_KEY` env var in your build environment, it will install the deploy key directly in the Docker image when running:

```text
docker build --build-arg XLWINGS_DEVELOPER_KEY=${XLWINGS_DEVELOPER_KEY} .
```
