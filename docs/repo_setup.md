# Git Repository Setup

## Prerequisites

- You will need basic familiarity with Git and have Git installed.
- This guide assumes that you have Python installed.

## Setup

1. Clone the xlwings Server repo. Replace `myproject` with the desired name of your project:

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

   ```{note}
   If you only want to play around with xlwings Server without committing any changes back to Git, you can continue with Step 7. If you want to commit your changes later, you can always come back and follow the Steps 2-6.
   ```

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

6. Push your local branch to your new origin:

   ```text
   git push -u origin main
   ```

7. To reduce future merge conflicts with the help of `.gitattributes`, run:

   ```text
   git config --local merge.ours.driver true
   ```

8. Install the `uv` package manager:

   ```text
   pip install uv
   ```

9. In the desired Python environment, install the development dependencies:

   ```text
   uv pip sync requirements-dev.txt
   ```

10. Initialize the repo. This will create an `.env` file for configuration and will create unique UUIDs in the `app/config.py` file.

    ```text
    python run.py init
    ```

11. Open the `.env` file and add your xlwings license key under `XLWINGS_LICENSE_KEY` (top of the file).

    ```{note}
    The `.env` file is ignored by Git as it may contain sensitive credentials. You should therefore back it up in a secure location such as a password manager.
    ```

12. Commit the changes and push everything to your own repo (feel free to use a Git UI instead of the following commands). If you just want to play around with xlwings Server, you can skip this step.

    ```text
    git add .
    git commit -m "updated uuids"
    git push origin main
    ```
