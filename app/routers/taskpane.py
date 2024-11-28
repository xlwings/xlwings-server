import pandas as pd
import plotly.express as px
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from .. import dependencies as dep
from ..config import settings
from ..templates import TemplateResponse

router = APIRouter(prefix=settings.app_path)


@router.get("/taskpane")
@router.get("/taskpane.html")
async def taskpane(request: Request):
    return TemplateResponse(
        request=request, name="examples/hello_world/taskpane_hello.html"
    )


@router.post("/plotly")
async def plot(book: dep.Book):
    # TODO: df should be html escaped
    df = book.sheets.active["A1"].expand().options(pd.DataFrame, index=False).value
    fig = px.bar(df, x="year", y="pop")
    plotly_jinja_data = fig.to_html(full_html=False, include_plotlyjs=False)
    return HTMLResponse(plotly_jinja_data)
