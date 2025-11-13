import logging
import time
import uuid

from xlwings.conversion import Converter

from . import settings
from .routers.xlwings import origin_context

logger = logging.getLogger(__name__)


class ImageConverter(Converter):
    @staticmethod
    def _cleanup_old_plots(temp_dir, max_age_minutes=2):
        """Remove plot files older than max_age_minutes"""
        try:
            current_time = time.time()
            max_age_seconds = max_age_minutes * 60

            for file_path in temp_dir.glob("plot_*.png"):
                if current_time - file_path.stat().st_mtime > max_age_seconds:
                    file_path.unlink()
                    logger.info(f"Deleted old plot file: {file_path}")
        except Exception as e:
            logger.warning(f"Error during plot cleanup: {e}")

    @staticmethod
    def write_value(obj, options):
        # Handle matplotlib figures
        try:
            import matplotlib.figure

            if isinstance(obj, matplotlib.figure.Figure):
                # Create temp directory for plots if it doesn't exist
                temp_dir = settings.static_dir / "images" / "temp"
                temp_dir.mkdir(parents=True, exist_ok=True)

                # Clean up old plot files
                ImageConverter._cleanup_old_plots(temp_dir)

                # Generate unique filename
                filename = f"plot_{uuid.uuid4().hex}.png"
                temp_file = temp_dir / filename

                # Save the figure to the temp file
                obj.savefig(temp_file, bbox_inches="tight", dpi=150)
                logger.info(f"Saved matplotlib figure to {temp_file}")

                # Build proper HTTP URL - Excel requires fully qualified URLs
                relative_url = f"{settings.static_url_path}/images/temp/{filename}"

                # Try to get origin from context (sent by client)
                try:
                    origin = origin_context.get()
                    if origin:
                        url = f"{origin}{settings.app_path}{relative_url}"
                    else:
                        raise LookupError
                except LookupError:
                    # Fallback to hostname setting if context not available
                    if settings.hostname:
                        url = f"{settings.hostname}{settings.app_path}{relative_url}"
                    else:
                        # Last resort fallback for development
                        logger.warning(
                            "Origin not available from client and XLWINGS_HOSTNAME not set. "
                            "Using localhost:8000 as fallback."
                        )
                        url = f"https://localhost:8000{settings.app_path}{relative_url}"

                logger.info(f"Generated image URL: {url}")

                return {
                    "type": "WebImage",
                    "address": url,
                }
        except ImportError:
            # matplotlib not installed, continue with other checks
            pass

        # Handle URL strings
        if isinstance(obj, str):
            url = obj
        else:
            # Fallback for unexpected types
            logger.warning(f"ImageConverter received unexpected type: {type(obj)}")
            url = str(obj)

        logger.info(f"Using image URL: {url}")

        return {
            "type": "WebImage",
            "address": url,
        }
