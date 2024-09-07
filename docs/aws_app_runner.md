# AWS App Runner

## Files

- `apprunner.yaml`

## Deployment

- In this repo, update `apprunner.yaml` with your `XLWINGS_LICENSE_KEY` either as `env` or `secret`
- In the AWS console, on the App Runner dashboard, click on `Create service`
- Repository type: Source code repository
- Source directory: `/`
- Deployment trigger: Automatic
- Configuration file: Use a configuration file
- Service name: e.g. `xlwings-server`
- Click on `Create & deploy`

## Limitations

- AWS App Runner functions don't support WebSockets, i.e., streaming functions and `trigger_script` won't work.
