# Manifest.xml

xlwings Server comes with a sample manifest under `xlwings_server/templates/manifest.xml`. It is a a [Jinja2](https://jinja.palletsprojects.com/) template that will produce the correct manifest for all environments (`dev`, `prod`, ...) when going to the manifest URL of the respective environment (e.g., `https://your.domain.com/manifest/download`).

## Key concepts

The manifest template has been set up so that you can have the same add-in installed for various environments (`dev`, `prod`, ...) without running into any conflicts:

- Each environment uses a unique `Id` (a UUID) that is stored in `pyproject.toml`. The `Id`s are created when running `uv run xlwings-server init`.
- Except for the `prod` environment, the ribbon tab shows the name of the environment in square brackets (e.g., `My Project [dev]`).
- Except for the `prod` environement, custom functions show the name of the environment at the end of the namespace (e.g., `MYPROJECT_DEV.MYFUNCTION()`).
- If the downloaded manifest from `/manifest/download` shows wrong URLs, set the `XLWINGS_HOSTNAME` environment variable.

## Editing the manifest template

You'll have to edit the manifest template for the following reasons:

- Adjust the infos towards the top of the file such as `Version`, `ProviderName`, etc.
- Adjust URLs to icons
- Change the groups and buttons etc. that you want to show on the ribbon
- Change the ribbon location, see [](#ribbon-location-office-tab-vs-custom-tab)

You should not need to change anything regarding custom functions, as everything is handled via settings.

### Button to show task pane

To show the task pane when clicking a button in the ribbon, you’ll need to configure the manifest accordingly. The relevant blocks are the following (these lines are out of context, so search for them in `manifest.xml`):

```xml
<!-- ... -->

<Control xsi:type="Button" id="TaskpaneButton">
  <!-- ... -->
  <!-- Action type must be ShowTaskpane -->
  <Action xsi:type="ShowTaskpane">
    <TaskpaneId>ButtonId1</TaskpaneId>
    <!-- resid must point to a Url Resource -->
    <SourceLocation resid="Taskpane.Url"/>
  </Action>
</Control>

<!-- ... -->

<!-- This must point to the HTML document with the task pane -->
<bt:Url id="Taskpane.Url" DefaultValue="{{ base_url_with_app_path }}/taskpane" />
```

### Button to call Python

See [](custom_scripts.md#run-custom-scripts).

## Ribbon location: Office tab vs. custom tab

The xlwings Server default ribbon has been set up as a custom tab in the ribbon. However, you can also integrate the add-in into an existing Excel tab, such as the `Home` tab, see [OfficeTab](https://learn.microsoft.com/en-us/javascript/api/manifest/officetab). To find the `id` of a specific tab, see [Find the IDs of built-in Office ribbon tabs](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/built-in-ui-ids).

## Further reading

- [Office Add-ins with the add-in only manifest](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/xml-manifest-overview)
- [Manifest reference](https://learn.microsoft.com/en-us/javascript/api/manifest)
