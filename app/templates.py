"""
Patched module from jinja2-fragments to make the API the same as the recently changed
FastAPI/Starlette API

The MIT License (MIT)

Copyright © 2022 Sergi Pons Freixes and the jinja2-fragments contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the “Software”), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT
OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
"""

import typing

try:
    from starlette.background import BackgroundTask
    from starlette.requests import Request
    from starlette.responses import HTMLResponse, Response
    from starlette.templating import Jinja2Templates, _TemplateResponse
except ModuleNotFoundError as e:
    raise ModuleNotFoundError(
        "Install Starlette to use jinja2_fragments.fastapi"
    ) from e

from jinja2 import Environment, FileSystemLoader
from jinja2_fragments import render_block

from .config import settings


class InvalidContextError(Exception):
    pass


class Jinja2Blocks(Jinja2Templates):
    def __init__(self, directory, **env_options):
        # Fixed Starlette deprecation warning
        env = Environment(loader=FileSystemLoader(directory), **env_options)
        super().__init__(env=env)

    def TemplateResponse(
        self,
        request: Request,
        name: str,
        context: dict,
        status_code: int = 200,
        headers: typing.Optional[typing.Mapping[str, str]] = None,
        media_type: typing.Optional[str] = None,
        background: typing.Optional[BackgroundTask] = None,
        *,
        block_name: typing.Optional[str] = None,
    ) -> Response:
        context["request"] = request
        template = self.get_template(name)

        if block_name:
            content = render_block(
                self.env,
                name,
                block_name,
                context,
            )
            return HTMLResponse(
                content=content,
                status_code=status_code,
                headers=headers,
                media_type=media_type,
                background=background,
            )
        return _TemplateResponse(
            template,
            context,
            status_code=status_code,
            headers=headers,
            media_type=media_type,
            background=background,
        )


# End patched module

templates = Jinja2Blocks(
    directory=settings.base_dir / "templates",
    trim_blocks=True,
    lstrip_blocks=True,
)

TemplateResponse = templates.TemplateResponse
