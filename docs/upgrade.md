# Upgrade xlwings Server

## Prerequisites

This guide assumes that you have set up your local Git repository according to [](repo_setup.md).

## Upgrade process

1. Fetch changes from `upstream` and merge them. Make sure to replace `<VERSION>` with the desired version, such as `0.5.3` or `upstream/main` for bleeding edge (see [Changelog](changelog.md)).

   ```text
   git fetch upstream
   git merge --no-edit <VERSION>
   ```

2. If you get a merge conflict, resolve it.

3. Compile the `requirements` files:

   ```text
   python run.py deps compile
   ```

4. Commit and push the `requirements` files to your repo (feel free to use a Git UI instead):

   ```text
   git add .
   git commit -m "updated requirements"
   git push origin main
   ```

5. Update your requirements locally:

   ```text
   uv pip sync requirements-dev.txt
   ```

   If you use Docker, rebuild your container instead:

   ```text
   docker compose build
   ```

## Merge vs. Rebase

Merge is recommended over rebase:

- Potential merge conflicts can be resolved in a single step
- There's no force push required
- The history of your own commits is preserved
- [](repo_setup.md) minimizes merge conflicts during merge operations via `.gitattributes`
