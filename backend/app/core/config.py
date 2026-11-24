"""Application configuration, read from environment variables.

Secrets (API keys) live only here on the server side and are never sent
to the frontend.
"""
import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent  # backend/app/
DATA_FILE = Path(os.environ.get("SCHOLARSHIPS_CSV", APP_DIR / "data" / "scholarships.csv"))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
GEMINI_TIMEOUT_SECONDS = float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "4"))

# The organizer dataset's CGPA values (2.0-3.9 minimums) are on the
# Bangladeshi university 4.00 scale; the dataset clearly establishes it.
CGPA_SCALE = 4.00

APP_NAME = "ScholarSync AI"
