# Static Site Generators

The task pane can be used to display web pages that are generated with a static site generator such as Sphinx, MkDocs, Jekyll, Hugo, or Docusaurus. For an overview of static site generators, see [Awesome Static Web Site Generators](https://github.com/myles/awesome-static-generators).

On this page, you'll find a walkthrough for Docusaurus.

## Docusaurus

For the docusaurus docs, see https://docusaurus.io/.

### Docusaurus config

In your `docusaurus.config.js` file, set the following config:

```
url: 'https://...'
baseUrl: '/docusaurus/'
```

Then run:

```text
npm run build
```

Copy the `build` directory as we'll need it in the next section.

### xlwings Server setup

1. Paste the copied `build` directory directly under `app` and rename it to `docusaurus`.

2. Add a new file `app/routers/docusaurus.py`:

   ```python
   from fastapi import APIRouter, Request
   from fastapi.responses import FileResponse

   from ..config import settings

   router = APIRouter()


   @router.get("/docusaurus/{path:path}")
   async def docusaurus(path: str, request: Request):
      base_path = settings.base_dir / "docusaurus"
      full_path = base_path / path

      if full_path.is_dir():
         full_path = full_path / "index.html"

      if full_path.exists():
         return FileResponse(full_path)
      else:
         return {"error": "File not found"}, 404
   ```

3. Under `app/main.py`, add the following:

   ```python
   from .routers.docusaurus import router as docusaurus_router
   # ...existing code...
   app.include_router(docusaurus_router)
   # ...existing code ...
   app.mount(
      "/docusaurus/",
      StaticFiles(directory=settings.base_dir / "docusaurus"),
      name="docusaurus",
   )
   ```

4. In your `app/templates/manifest.xml`, set the task pane URL to:

   ```xml
   <bt:Url id="Taskpane.Url" DefaultValue="https://127.0.0.1:8000/docusaurus" />
   ```

5. Update your manifest with the content of `https://127.0.0.1:8000/manifest`.
6. Restart Excel and reload your add-in.
