# Dev Containers

[Dev containers](https://containers.dev/) let you run your full development environment in a container without installing anything locally other than Docker and an editor. They integrate tightly with your editor, so debugging, code navigation, and the integrated terminal all work as if you were running everything locally. Both VS Code and PyCharm Professional support dev containers.

xlwings Server ships a ready-to-use dev container configuration that you can add to your project with a single command.

## Adding the dev container to your project

From your project root, run:

```bash
uv run xlwings-server add devcontainer
```

This creates `.devcontainer/devcontainer.json`. Commit it to your repo so other developers (and GitHub Codespaces) pick it up automatically.

## VS Code

Make sure you meet the following two prerequisites:

- Docker Desktop installed and running
- The [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension installed in VS Code

With the project open in VS Code, click the double-arrow icon at the bottom-left of the window and pick **Reopen in Container**. Alternatively, open the command palette (`F1` / `Cmd+Shift+P` / `Ctrl+Shift+P`) and run **Dev Containers: Reopen in Container**.

To use Git from inside the container, follow [Sharing Git credentials with your container](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials).

## GitHub Codespaces

GitHub Codespaces builds on dev containers. Once your repo contains a `.devcontainer/devcontainer.json`, opening it in Codespaces (via the green **Code** button on GitHub → **Codespaces** tab) automatically provisions an environment using that configuration.

## PyCharm Professional

See the [PyCharm docs](https://www.jetbrains.com/help/pycharm/connect-to-devcontainer.html) for how to connect to a dev container from PyCharm.
