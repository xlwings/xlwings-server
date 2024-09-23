# Static Site Generators

The task pane can be used to display web pages that are generated with a static site generator such as Sphinx, MkDocs, Jekyll, Hugo, or Docusaurus. For an overview of static site generators, see [Awesome Static Web Site Generators](https://github.com/myles/awesome-static-generators).

On this page, you'll find a walkthrough for Docusaurus.

## Docusaurus

For the docusaurus docs, see https://docusaurus.io/.

### Docusaurus config

In your `docusaurus.config.js` file, set the following config:

```
url: 'https://...'
baseUrl: '/taskpane/'
```

Then run:

```text
npm run build
```

Copy the `build` directory as we'll need it in the next section.

### xlwings Server setup

1. Paste the copied `build` directory under `app/static` and rename it to `docusaurus` so that you end up with `app/static/docusaurus`.

2. Replace `app/routers/taskpane.py` with:

   ```python
   from fastapi import APIRouter, HTTPException, Request
   from fastapi.responses import FileResponse

   from ..config import settings

   router = APIRouter()


   @router.get("/taskpane/{path:path}")
   async def taskpane(path: str, request: Request):
      full_path = settings.static_dir / "docusaurus" / path

      if full_path.is_dir():
         full_path = full_path / "index.html"

      if full_path.exists():
         return FileResponse(full_path)
      else:
         raise HTTPException(status_code=404, detail="File not found")
   ```
