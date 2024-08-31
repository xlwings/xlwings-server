# Initial Setup

You will need basic familiarity with Git and have Git installed.

1. Clone the [xlwings-server](https://github.com/xlwings/xlwings-server) repo. Replace `myproject` with the name of your project:

   ::::{tab-set}
   :::{tab-item} HTTPS
   :sync: https

   ```text
   git clone https://github.com/xlwings/xlwings-server.git myproject
   ```

   :::

   :::{tab-item} SSH
   :sync: ssh

   ```text
   git clone git@github.com:xlwings/xlwings-server.git myproject
   ```

   :::
   ::::

2. Change into the directory of your project:

   ```text
   cd myproject
   ```

3. Rename the remote from `origin` to `upstream`:

   ```text
   git remote rename origin upstream
   ```

4. Create your own (empty) Git repo `myproject` on GitHub or any other Git provider and copy the clone URL.

5. Add the clone URL of your own Git repo:

   ```text
   git remote add origin <URL>
   ```

6. To prevent future merge conflicts with the `requirements` files, run:

   ```text
   git config --local merge.ours.driver true
   ```

7. In the desired Python environment, install the development dependencies:

   ```text
   pip install -r requirements-dev.txt
   ```

8. Initialize the repo. This will create an `.env` file for configuration and will create unique UUIDs in the `app/config.py` file.

   ```text
   python run.py init
   ```

9. Open the `.env` file and add your xlwings license key under `XLWINGS_LICENSE_KEY` (top of the file). Note that `.env` is ignored by Git as it may contain sensitive credentials. You should therefore back it up in a secure location such as a password manager.

10. Commit and push your changes to your own repo:

    ```text
    git add .
    git commit -m "updated uuids"
    git push origin main
    ```

11. This step is only required if you want to create [Office.js add-ins](clients.md#officejs-add-in-recommended): Create TLS certificates for localhost by downloading [mkcert](https://github.com/FiloSottile/mkcert/releases) (pick the correct file according to your platform), rename the file to `mkcert`, then run the following commands from a Terminal/Command Prompt (make sure you're in the same directory as `mkcert`):

    ```text
    ./mkcert -install
    ./mkcert localhost 127.0.0.1 ::1
    ```

    This will generate two files `localhost+2.pem` and `localhost+2-key.pem`: move them to the `certs` directory.
