from typing import Annotated

import jinja2
import xlwings as xw
from fastapi import Depends
from jinja2_fragments.fastapi import Jinja2Blocks

from . import settings

# Template directory
# Add xlwings.html as additional source for templates so the /xlwings/alert endpoint
# will find xlwings-alert.html.
loader = jinja2.ChoiceLoader(
    [
        jinja2.FileSystemLoader(settings.base_dir / "templates"),
        jinja2.PackageLoader("xlwings", "html"),
    ]
)
templates = Jinja2Blocks(
    directory=settings.base_dir / "templates",
    loader=loader,
    trim_blocks=True,
    lstrip_blocks=True,
)


# Book dependency
def get_book(body: dict):
    """Dependency that returns the calling book and cleans it up again"""
    book = xw.Book(json=body)
    try:
        yield book
    finally:
        book.close()


# This is the type annotation that we're using in the endpoints
Book = Annotated[xw.Book, Depends(get_book)]
