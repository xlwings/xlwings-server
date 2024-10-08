# Dev Containers

[Dev containers](https://containers.dev/) allow you to run your complete development environment in a container without having to install anything locally other than Docker and an editor. In contrast to [](dev_docker.md), it integrates your editor much better so that things like debugging and code navigation work as if you were running everything locally. Both VS Code and PyCharm Professional support dev containers.

## VS Code

### Prerequisites

- You need to have Docker installed and running
- You need to have Microsoft's `Dev Containers` extension installed

### Running a dev container

If you have your repo open in VS Code, you can click on the double-arrow icon on the bottom left in VS Code, then select `Reopen in Container`. Alternatively, open the command pallette via `F1` or `Ctrl+Shift+P` or `Cmd+Shift+P`, respectively, and search for `Dev Containers: Reopen in Container`.

To use Git via dev containers, follow [Sharing Git credentials with your container](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials).

## PyCharm Professional

See the [PyCharm docs](https://www.jetbrains.com/help/pycharm/connect-to-devcontainer.html).
