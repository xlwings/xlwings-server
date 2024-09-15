# Tunneling

If you are developing on your local computer against the Office Scripts or Google Apps Script integrations, you will need to expose your development server via a tunneling solution. This is because the Office Scripts and Google Apps Script can only connect to servers on the Internet, but not directly to your local computer.

This isn't necessary if you use the Office.js add-ins or VBA integrations. However, if you develop with Office.js add-ins and experience issues installing [](dev_certificates.md), you might alternatively use a tunneling solution as it will expose your local web service via a https.

```{note}
Tunneling solutions work by creating a secure connection between your local development server and a public endpoint on the Internet. This allows external services, such as Office Scripts or Google Apps Script, to access your local server as if it were hosted online. However, it's important to trust the tunneling provider, as you are granting them access to route traffic to and from your local machine. Always ensure you are using a reputable provider to maintain the security of your development environment.
```

## ngrok

[ngrok](https://ngrok.com/) is a popular provider and free for what we'll use it for.

- [Create an account](https://dashboard.ngrok.com/signup)
- [Install ngrok](https://ngrok.com/download)

Now you can run the following command on your Terminal/Command Prompt:

```text
ngrok http 8000
```

You should see something along the following lines:

```text
ngrok                                                                                                                (Ctrl+C to quit)

Share what you're building with ngrok https://ngrok.com/share-your-ngrok-story

Session Status                online
Account                       xxx@xxx.com (Plan: Free)
Version                       3.16.0
Region                        Europe (eu)
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:8000

Connections                   ttl     opn     rt1     rt5     p50     p90
                            0       0       0.00    0.00    0.00    0.00
```

`https://xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx.ngrok-free.app` is the URL that you need to use as base URL in your `runPython` function in Office Scripts and Google Apps Script. This means that the complete URL to call a custom script would be (make sure to replace `hello_world` with the name of your custom script):

```
https://xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx.ngrok-free.app/xlwings/custom-scripts-call/hello_world
```

To exit ngrok again, hit `Ctrl-C` in your Terminal/Command Prompt.

:::{note}

- If you have certificates in your `certs` folder (see [](dev_certificates.md)), you will need to run ngrok as follows so it connects to your local server running on https:

  ```text
  ngrok http https://127.0.0.1:8000
  ```

- You can configure ngrok so that it will always use the same URL, see the [docs](https://ngrok.com/docs/getting-started/#step-4-always-use-the-same-domain).

- Note that by default, ngrok will expose your local web server publicly so anyone with the URL can access your backend.

:::

## Alternatives

Instead of ngrok, you can use many other solutions such as [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). For a curated list of alternatives, see [Awesome Tunneling](https://github.com/anderspitman/awesome-tunneling).
