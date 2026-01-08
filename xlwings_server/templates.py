from __future__ import annotations

import typing

from fastapi import Request
from jinja2 import ChoiceLoader, FileSystemLoader
from jinja2_fragments.fastapi import Jinja2Blocks
from starlette.background import BackgroundTask

from xlwings_server.config import PACKAGE_DIR, PROJECT_DIR, settings

# Create Jinja2 loader that checks project templates first, then package templates
loader = ChoiceLoader(
    [
        FileSystemLoader(PROJECT_DIR / "templates"),
        FileSystemLoader(PACKAGE_DIR / "templates"),
    ]
)


templates = Jinja2Blocks(
    directory=PROJECT_DIR / "templates",
    loader=loader,
    trim_blocks=True,
    lstrip_blocks=True,
)


# Align with FastAPIs changes to the function signature
def TemplateResponse(
    request: Request,
    name: str,
    context: dict[str, typing.Any] | None = None,
    status_code: int = 200,
    headers: typing.Mapping[str, str] | None = None,
    media_type: str | None = None,
    background: BackgroundTask | None = None,
    block_names: str | list[str] | None = None,
    **kwargs: typing.Any,
):
    if context is None:
        context = {}
    context["request"] = request
    context["settings"] = settings
    return templates.TemplateResponse(
        name,
        context,
        status_code,
        headers,
        media_type,
        background,
        block_name=block_names if isinstance(block_names, str) else None,
        block_names=block_names if isinstance(block_names, list) else [],
        **kwargs,
    )
