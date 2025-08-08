import logging

from xlwings.conversion import Converter

logger = logging.getLogger(__name__)


class ImageConverter(Converter):
    @staticmethod
    def write_value(obj, options):
        return {
            "type": "WebImage",
            "address": "https://localhost:8000/static/images/ribbon/examples/xlwings-64.png",
        }
