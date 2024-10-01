# Development TLS Certs

Development TLS certificates are only required for Office.js add-ins as they require the web server to run on https instead of http---even on localhost.

[Download mkcert](https://github.com/FiloSottile/mkcert/releases) (pick the correct file according to your platform), rename the file to `mkcert`, then run the following commands from a Terminal/Command Prompt (make sure you're in the same directory as `mkcert`):

```text
./mkcert -install
./mkcert localhost 127.0.0.1 ::1
```

This will generate two files `localhost+2.pem` and `localhost+2-key.pem`. Move them from your current directory to the `certs` directory in your repo.

```{note}
If you are unable to use `mkcert`, you can alternatively use [](tunneling.md) or an online development environment such as [](github_codespaces.md) to run your server on `https` rather than `http`.
```
