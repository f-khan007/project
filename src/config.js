"use strict";
/* Application configuration, read from environment variables.
 *
 * Secrets (API keys) live only here on the server side and are never
 * sent to the frontend. (Port of backend/app/core/config.py.)
 */
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, ".."); // project root
const DATA_FILE = process.env.SCHOLARSHIPS_CSV
  ? path.resolve(process.env.SCHOLARSHIPS_CSV)
  : path.join(ROOT_DIR, "data", "scholarships.csv");

const settings = {
  DATA_FILE,
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || "").trim(),
  GEMINI_MODEL:
    (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim() || "gemini-2.0-flash",
  GEMINI_TIMEOUT_SECONDS: parseFloat(process.env.GEMINI_TIMEOUT_SECONDS || "4"),
};

// The organizer dataset's CGPA values (2.0-3.9 minimums) are on the
// Bangladeshi university 4.00 scale; the dataset clearly establishes it.
const CGPA_SCALE = 4.0;

const APP_NAME = "ScholarSync AI";

module.exports = { settings, CGPA_SCALE, APP_NAME, ROOT_DIR };
