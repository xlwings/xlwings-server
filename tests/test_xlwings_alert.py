from bs4 import BeautifulSoup
from fastapi.testclient import TestClient

from app.main import main_app

client = TestClient(main_app)


def test_get_alert():
    # String to the right of $_hostInfo added by Excel
    response = client.get(
        "xlwings/alert?prompt=Exception(%27test%27)&title=Error&buttons=ok&mode=critical&callback=&_host_Info=Excel$Mac$16.01$en-US$telemetry$isDialog$$0"
    )
    assert response.status_code == 200
    assert (
        '<button id="ok" type="button" class="btn btn-primary btn-xl-alert">OK</button>'
        in response.text
    )
    assert '<h1 class="pt-4">Error</h1>' in response.text
    assert "<p>Exception('test')</p>" in response.text

    # Check script tag
    soup = BeautifulSoup(response.text, "html.parser")
    script_tags = soup.find_all("script")
    script_tag = next(
        (tag for tag in script_tags if "xlwings-alert.js" in tag.get("src", "")), None
    )
    assert script_tag is not None
    script_response = client.get(script_tag["src"])
    assert script_response.status_code == 200
