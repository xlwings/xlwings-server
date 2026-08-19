# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = "xlwings Server"
copyright = "Zoomer Analytics GmbH"
author = "Zoomer Analytics GmbH"

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    "myst_parser",
    "sphinx_copybutton",
    "sphinx_design",
    "sphinx_llm.txt",
]

templates_path = ["_templates"]
html_css_files = ["custom.css"]
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]


myst_heading_anchors = 3
myst_enable_extensions = ["colon_fence", "linkify"]
myst_links_external_new_tab = True
myst_linkify_fuzzy_links = False  # Require links to start with http://

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = "furo"
html_static_path = ["_static"]
html_favicon = "_static/favicon.png"
html_show_sourcelink = False
# Link icon for the per-heading permalinks (Sphinx inserts this as raw HTML),
# replacing the default pilcrow. "currentColor" follows the light/dark theme.
html_permalinks_icon = (
    '<svg class="headerlink-icon" xmlns="http://www.w3.org/2000/svg"'
    ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>'
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
    "</svg>"
)
html_copy_source = False
html_theme_options = {
    "sidebar_hide_name": True,
    "top_of_page_buttons": [],
    "light_logo": "logo-server-light.svg",
    "dark_logo": "logo-server-dark.svg",
    "light_css_variables": {
        "color-brand-primary": "black",
        "color-brand-content": "#28a745",
        # Match visited links to unvisited ones; Furo's default is a purple
        # (#872ee0) that clashes with the green brand color.
        "color-brand-visited": "#28a745",
        "color-sidebar-caption-text": "#28a745",
        "sidebar-caption-font-size": "1em",
        "color-announcement-background": "#28a745",
    },
    "dark_css_variables": {
        "color-brand-primary": "white",
        # Lighter green than light mode (#28a745) for contrast on the dark
        # sidebar; drives the active sidebar item's accent bar/text/tint.
        "color-brand-content": "#3fbf5f",
        "color-brand-visited": "#3fbf5f",
        "color-announcement-background": "#28a745",
    },
    "footer_icons": [
        {
            "name": "GitHub",
            "url": "https://github.com/xlwings/xlwings-server",
            "html": """
                <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
            """,
            "class": "",
        },
    ],
}

# -- LLM-friendly output -----------------------------------------------------
# Generates llms.txt, llms-full.txt, and a rendered Markdown version of each
# page alongside the regular HTML documentation.
llms_txt_description = (
    "Documentation for xlwings Server, a framework to build Office.js add-ins "
    "with Python on your own server."
)
llms_txt_suffix_mode = "replace"

copybutton_prompt_text = r">>> |\.\.\. |\$ |In \[\d*\]: | {2,5}\.\.\.: | {5,8}: "
copybutton_prompt_is_regexp = True

suppress_warnings = ["misc.highlighting_failure"]


def _prepare_markdown_doctree(app, doctree, docname):
    """Fix internal references and asset URLs in generated Markdown."""
    if app.builder.name != "markdown":
        return

    from docutils import nodes

    for node in doctree.findall(nodes.reference):
        if node.get("refid") and not node.get("refuri"):
            node["internal"] = True

    for node in doctree.findall(nodes.image):
        image = app.env.images.get(node["uri"])
        if image:
            node["uri"] = f"/_images/{image[1]}"


def _add_markdown_twin_flag(app, pagename, templatename, context, doctree):
    """Flag pages that have a rendered Markdown twin.

    sphinx_llm emits a .md file per source document, but not for generated
    pages like genindex/search — linking those would 404. base.html uses this
    to decide whether to emit the text/markdown <link rel="alternate">.
    """
    context["has_markdown_twin"] = pagename in app.env.found_docs


def setup(app):
    app.connect("doctree-resolved", _prepare_markdown_doctree)
    app.connect("html-page-context", _add_markdown_twin_flag)
