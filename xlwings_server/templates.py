from jinja2 import ChoiceLoader, Environment, FileSystemLoader
from jinja2_fragments.fastapi import Jinja2Blocks

from xlwings_server.config import PACKAGE_DIR, PROJECT_DIR, settings

# Create Jinja2 loader that checks dist templates first (if exists),
# then project templates, then package templates
loaders = []
dist_templates = PROJECT_DIR / "dist" / "templates"
if dist_templates.exists() and settings.environment != "dev":
    loaders.append(FileSystemLoader(dist_templates))
loaders.extend(
    [
        FileSystemLoader(PROJECT_DIR / "templates"),
        FileSystemLoader(PACKAGE_DIR / "templates"),
    ]
)
loader = ChoiceLoader(loaders)


env = Environment(loader=loader, autoescape=True, trim_blocks=True, lstrip_blocks=True)
templates = Jinja2Blocks(
    env=env,
    context_processors=[lambda request: {"settings": settings}],
)
TemplateResponse = templates.TemplateResponse
