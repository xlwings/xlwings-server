# Python Dependencies

To prevent Git merge conflicts, the Python dependencies are split up into 3 files (note the `.in` instead of `.txt` file extension):

- `requirements.in`: Your application-specific top-level dependencies. This is usually the only file you should edit.
- `requirements-core.in`: Dependencies required by xlwings Server.
- `requirements-dev.in`: Additional dependencies only required during development.

Here's an example of `requirements.in`:

```
-r requirements-core.txt  # Don't delete this line
pandas
numpy==1.26.4
```

When you first clone xlwings Server, there will be a few dependencies in `requirements.in`. They are there to make the examples work out of the box, but you should replace them with your own top-level dependencies. The `.txt` version of the requirements files need to be compiled, as we'll see next.

## Prerequisities

You need the package manager [uv](https://docs.astral.sh/uv/), which you can install either via

```
pip install uv
```

or by following the [uv docs](https://docs.astral.sh/uv/getting-started/installation/).

## Add/remove dependencies

1. Edit `requirements.in` (note `.in`, not `.txt`) to add your application-specific dependencies.
2. Create the `.txt` versions of the `requirements` files by running:

   ```text
   python run.py deps compile
   ```

   The `.txt` versions are the lock files where all dependencies incl. sub-dependencies are pinned.

3. Update your local dev environment by running:

   ```text
   uv pip sync requirements-dev.txt
   ```

   If you use Docker, you need to rebuild your container instead:

   ```text
   docker compose build
   ```

4. Commit and push the changed `requirements` files to Git.

## Upgrade dependencies

Run the following command:

```text
python run.py deps upgrade
```

Note, however, that this command upgrades all the packages, including core and dev dependencies.

## Conda environments

If you'd like to use a Conda env because e.g., you have dependencies that are only available via Conda, do the following:

1. Create a new Conda env. Make sure to replace `myenv` with the desired name of your environment:

   ```text
   conda create -n myenv python=3.12 -y
   ```

2. Activate the Conda env:

   ```text
   conda activate myenv
   ```

3. Install the `uv` package manager:

   ```text
   pip install uv
   ```

4. Install `requirements-dev.txt` (for development) or `requirements.txt` otherwise:

   ```text
   uv pip sync requirements-dev.txt
   ```

5. Install conda dependencies (instead of `blas`, provide your own packages):

   ```text
   conda install blas
   ```

6. Export the environment into `environment.yml` (call it `environment-dev.yml` if this is a development environment):

   ```text
   conda env export > environment.yml
   ```

Commit `environment.yml` to Git. You can now use it to recreate this specific Conda environment whenever you need it via `conda env create -f environment.yml`.
