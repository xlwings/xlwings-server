# xlwings Lite Deployment

## Build command

To turn your xlwings Lite app into a static website, use the `lite` command:

```none
$ python run.py lite --help
usage: run.py lite [-h] [-o OUTPUT] [-z] [-c] url

positional arguments:
  url                   URL of where the xlwings Lite app is going to be hosted

options:
  -h, --help            show this help message and exit
  -o OUTPUT, --output OUTPUT
                        Output directory path. Defaults to ./dist.
  -z, --zip             Create zip archive in addition to the static files.
  -c, --clean           Clean the output directory before building.
```

## Deploy to Cloudflare Pages

[Cloudflare Pages](https://pages.cloudflare.com/) are great as you have unlimited traffic for free. To be sure, always check their current limits.

You can either connect Cloudflare Pages to a Git repository or you can also upload a ZIP file directly if you're just want to quickly try it out.

After creating a project, you'll get a URL that looks something like this: https://xxxxx.pages.dev. Use it in the following command:

```none
python run.py lite https://xxxxx.pages.dev --zip
```

Now you can upload the ZIP file that you will find in the `./dist` directory. Alternatively, create a new Git repo, connect it with Cloudflare Pages, and direct the build command towards that Git repo:

```none
python run.py lite https://xxxxx.pages.dev -o ./path/to/repo
```

## Deploy to GitHub Pages

[GitHub Pages](https://docs.github.com/en/pages) are usually hosted on `https://username.github.io/reponame`. Therefore, your build command should be:

```none
python run.py lite https://username.github.io/reponame -o /path/to/your/static-repo
```

## Offline usage

By default, Pyodide is served via their CDN. This has the advantage that you don't need to manually

copy the Python wheels into the `/app/static/vendor/pyodide` directory. The other advantage is that some of these wheels are quite big and will be beyond the limit of what providers like Cloudflare or GitHub accept

- Office.js -> many files
- Pyodide -> file size
