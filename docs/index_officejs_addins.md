# Office.js Add-ins

Office.js add-ins are web apps that can interact with Excel. In their simplest form, they consist of just two files:

- **Manifest XML file**: This is a configuration file that is loaded in Excel (either manually during development or via the add-in store for production). It defines the ribbon buttons and includes the URL to the backend/web server.

- **HTML file**: The HTML file has to be served by a web server and defines the layout and functionality of the task pane as well as commands (commands are functions that are directly linked to ribbon buttons).

To get a better understanding about how the simplest possible add-in works (without Python or xlwings), have a look at the following repo:

https://github.com/xlwings/officejs-helloworld.

Follow the repo’s `README` if you want to load the add-in locally in Excel.

```{toctree}
:maxdepth: 1
:hidden:

install_officejs_addin
officejs_run_scripts
manifest
debugging
```
