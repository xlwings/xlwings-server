# xlwings Server

* Custom functions can be added under `app/custom_functions/sample.py`. There is a sample custom function included that can be run via `=XLWINGS.HELLO("xlwings")`. The `XLWINGS` prefix ("namespace") can be adjusted in `manifest.xml` and should be different for each environment (DEV, UAT, PROD, etc.)
* Macros can be added under `app/routers/macros.py`. They will need to be bound to a button on either the ribbon (via `manifest.xml`) or task pane (via `app/templates/taskpane.html`). There is a sample button `Hello World` included on both the ribbon and task pane.

## Prod deployment

* **Note that the web app *has* to be served via https, not http!**
* **The app could be deployed directly via Dockerfile using a service such as Render.com, Heroku, etc. and only requires the XLWINGS_LICENSE_KEY environment variable to be set.**

**Backend via Python directly:**

* Set the environment variable `XLWINGS_LICENSE_KEY=...`
* Install the dependencies `pip install -r requirements.txt`
* Run the app `gunicorn app.main:cors_app --bind 0.0.0.0:8000 --access-logfile --workers 2 --worker-class uvicorn.workers.UvicornWorker`

**Backend via Docker**:

* Install Docker and Docker Compose
* Copy `.env.template` to `.env` and update `XLWINGS_LICENSE_KEY=...`
* `docker compose -f docker-compose.prod.yaml build`
* `docker compose -f docker-compose.prod.yaml up -d`

**Frontend via Office.js add-in:**

* In `manifest.xml`, replace all occurrences of `https://127.0.0.1:8000` with the URL where your server runs. It is recommended to create a copy of `manifest.xml` for each environment (DEV, UAT, PROD, etc.).
* In `manifest.xml`, set your own ID (see TODO comment in `manifest.xml`). You should use an own ID for each environment (DEV, UAT, PROD, etc.).
* The `manifest.xml` has to be deployed via the Office admin console, see: https://docs.xlwings.org/en/latest/pro/server/officejs_addins.html#production-deployment

## Dev environment

Follow the steps under https://docs.xlwings.org/en/latest/pro/server/officejs_addins.html#quickstart (but using this repo instead of the one mentioned in the quickstart). Mainly, you need to install `mkcert` to create local certificates as Office.js requires the web app to served via https (not http) even on localhost.

**Backend via Python directly:**

* Set the environment variable `XLWINGS_LICENSE_KEY=...`
* Install the dependencies `pip install -r requirements.txt`
* Run the app: `python run.py`

**Backend via Docker**:

* Install Docker and Docker Compose
* Copy `.env.template` to `.env` and update `XLWINGS_LICENSE_KEY=...`
* To run the dev server: `docker compose up -d`
* Run `docker compose build` whenever you need to install a new dependency via `requirements.txt`

**Office.js add-in**:

* Has to be sideloaded, see: https://learn.microsoft.com/en-us/office/dev/add-ins/testing/test-debug-office-add-ins#sideload-an-office-add-in-for-testing
