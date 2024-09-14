# Upgrade xlwings Server

This guide assumes that you have set up your local Git repository according to [](repo_setup.md).

1. Fetch changes from `upstream` and merge them. Make sure to replace `<VERSION>` with the desired version, such as `0.5.3` or `main` for the latest release (see [Changelog](changelog.md)).

   ```text
   git fetch upstream
   git merge --no-edit <VERSION>
   ```

2. If you get a merge conflict, resolve it.

3. Compile the `requirements` files:

   ```text
   python run.py deps compile
   ```

4. Commit and push the `requirements` files to your repo:

   ```text
   git add .
   git commit -m "updated requirements"
   git push origin main
   ```

5. Update your requirements locally:

   ```text
   uv pip sync requirements-dev.txt
   ```
