# Development Certificates

This step is only required if you want to create [Office.js add-ins](clients.md#officejs-add-in-recommended): Create TLS certificates for localhost by downloading [mkcert](https://github.com/FiloSottile/mkcert/releases) (pick the correct file according to your platform), rename the file to `mkcert`, then run the following commands from a Terminal/Command Prompt (make sure you're in the same directory as `mkcert`):

```text
./mkcert -install
./mkcert localhost 127.0.0.1 ::1
```

This will generate two files `localhost+2.pem` and `localhost+2-key.pem`: move them to the `certs` directory.
