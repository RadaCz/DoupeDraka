import logging
from datetime import datetime
from pathlib import Path

_log_handler = None

def get_logger():
    """Lazy logger initialization to avoid import-time errors."""
    global _log_handler
    if _log_handler is None:
        Path("logs").mkdir(exist_ok=True)
        _log_handler = logging.FileHandler(f"logs/app_{datetime.now():%Y%m%d}.log")
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.StreamHandler(),
                _log_handler,
            ],
        )
    return logging.getLogger(__name__)

logger = get_logger()
