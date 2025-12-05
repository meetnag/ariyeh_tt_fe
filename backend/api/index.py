"""
Vercel serverless entrypoint for FastAPI.

This imports the FastAPI app from app.main so Vercel can route requests.
"""
import sys
from pathlib import Path

# Ensure backend/ is on the path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_ROOT = CURRENT_DIR.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402
