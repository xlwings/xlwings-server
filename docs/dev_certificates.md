# Development Certificates

If you are developing on your local computer with the following integration:

- Office.js Add-in

you will need to create development TLS certificates to run the web server on https instead of http. Note that development certificates are never required if you use an online development environment such as [](github_codespaces.md).

mkcert makes it easy to install self-signed certificates that are trusted by your web browser.

## mkcert

[Download mkcert](https://github.com/FiloSottile/mkcert/releases) (pick the correct file according to your platform), rename the file to `mkcert`, then run the following commands from a Terminal/Command Prompt (make sure you're in the same directory as `mkcert`):

```text
./mkcert -install
./mkcert localhost 127.0.0.1 ::1
```

This will generate two files `localhost+2.pem` and `localhost+2-key.pem`. Move them from your current directory to the `certs` directory in your repo.

## Alternatives

If you are unable to use `mkcert`, you can alternatively use [](tunneling.md) or an online development environment such as [](github_codespaces.md) to run your server on `https` rather than `http`.
