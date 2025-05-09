# xlwings Wasm Deployment

## Build command

To turn your xlwings Wasm app into a static website, use the `lite` command:

```none
$ python run.py lite --help
usage: run.py lite [-h] [-o OUTPUT] [-z] [-c] [-e ENV] url

positional arguments:
  url                   URL of where the xlwings Wasm app is going to be hosted

options:
  -h, --help            show this help message and exit
  -o OUTPUT, --output OUTPUT
                        Output directory path. Defaults to ./dist.
  -z, --zip             Create zip archive in addition to the static files.
  -c, --clean           Clean the output directory before building.
  -e ENV, --env ENV     Sets the XLWINGS_ENVIRONMENT. By default uses the one from .env file.
```

For example, if your static file server serves the files at `https://my.domain.com`, run the following command:

```none
$ python run.py lite https://my.domain.com
```

Then copy the files from the `dist` directory to your static file server. Open up `https://my.domain.com` in a browser to make sure the deployment worked. Then use `https://my.domain.com/manifest.xml` to install the actual add-in, see [](install_officejs_addin.md).

To get started, it is recommended to use the following settings under `.env` while building your xlwings Wasm app to reduce the number of files you have to upload:

```ini
XLWINGS_CDN_OFFICEJS=true
XLWINGS_CDN_PYODIDE=true
```

For more details, see [](#without-internet-access) below.

## Deploy to Cloudflare Pages

To deploy to [Cloudflare Pages](https://pages.cloudflare.com/), you have various options:

- Upload a ZIP file manually
- Connect to a Git repo from Cloudflare
- Use a CI pipeline (e.g., GitHub actions) and deploy to Cloudflare via Cloudflare's Wrangler CLI (for Github actions, you can use cloudflare/wrangler-action)

### Manual deployment

After creating a project, you'll get a URL that looks something like this: `https://xxx.pages.dev`. Use it in the following command:

```none
python run.py lite https://xxx.pages.dev --zip
```

Now you can upload the ZIP file that you will find in the `dist` directory.

### Connect to Git repo

Alternatively, create a new Git repo, connect it with Cloudflare Pages, and direct the build command towards a subdirectory in that Git repo:

```none
python run.py lite https://xxx.pages.dev -o /path/to/repo/xlwings_serverless
```

Commit and push the files.

### CI pipeline

TODO

## Deploy to GitHub Pages

GitHub pages are usually hosted on `https://username.github.io/reponame`. Therefore, your build command should be:

```none
python run.py lite https://username.github.io/reponame -o /path/to/repo/xlwings_serverless
```

Consult the [GitHub Pages docs](https://docs.github.com/en/pages) on how to deploy the page.

TODO: add GitHub actions yml that builds the page and deploys it automatically from the source repository.

## Without Internet access

By default, xlwings Wasm uses Pyodide via their CDN (Content Delivery Network). This means that **on the end-user's machine** (not on the static file server), Excel will download the Pyodide files from their CDN and Python packages either from their CDN or directly from PyPI, which requires access to the public Internet.

This has the obvious advantage of being much easier to get started with as you don't need to serve the Python wheels yourself. The other advantage is that some of these wheels are really big and will be beyond the limit of what providers like Cloudflare or GitHub accept as individual file size.

When building your xlwings Wasm distribution for the first time, it is therefore recommended to use the following settings in `.env` as it will make it easier to get started (your `dist` folder will have both fewer files and smaller files):

```ini
XLWINGS_CDN_OFFICEJS=true
XLWINGS_CDN_PYODIDE=true
```

If you want xlwings Wasm to work without connection to the public Internet, you will need to switch both settings to `false` though. You will then need to copy all Python packages (`.whl` files) into the `app/static/vendor/pyodide` folder and reference them explicitly in the `app/lite/requirements.txt` file like so:

```
/static/vendor/pyodide/mypackage.whl
```

Please also refer to [](wasm_development.md#dependencies).
