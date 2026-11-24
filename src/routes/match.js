"use strict";
const { Router } = require("express");
const { validateProfile, validateSortBy } = require("../models/student");
const { evaluate } = require("../services/eligibilityEngine");
const { asNearMatch } = require("../services/nearMatch");
const explanationService = require("../services/explanationService");
const { resultToDict } = require("../models/matchResult");

const router = Router();

function cmpName(a, b) {
  const na = a.scholarship.name.toLowerCase();
  const nb = b.scholarship.name.toLowerCase();
  return na < nb ? -1 : na > nb ? 1 : 0;
}

function cmpDeadline(a, b) {
  const da = a.scholarship.deadline;
  const db = b.scholarship.deadline;
  if (da === null && db === null) return cmpName(a, b);
  if (da === null) return 1; // missing dates last
  if (db === null) return -1;
  if (da !== db) return da < db ? -1 : 1;
  return cmpName(a, b);
}

function cmpAmount(a, b) {
  const aa = a.scholarship.amount_bdt;
  const ab = b.scholarship.amount_bdt;
  if (aa === null && ab === null) return cmpName(a, b);
  if (aa === null) return 1; // missing amounts last
  if (ab === null) return -1;
  if (aa !== ab) return ab - aa; // descending
  return cmpName(a, b);
}

function sortResults(results, sortBy) {
  const sorted = [...results];
  if (sortBy === "amount") sorted.sort(cmpAmount);
  else if (sortBy === "name") sorted.sort(cmpName);
  else sorted.sort(cmpDeadline); // deadline default, missing last
  return sorted;
}

router.post("/api/match", async (req, res, next) => {
  try {
    const profile = validateProfile(req.body);
    const sortBy = validateSortBy(req.body);
    const dataset = req.app.locals.dataset;

    const eligible = [];
    const nearMatches = [];
    const needsReview = [];
    for (const scholarship of dataset) {
      const result = evaluate(profile, scholarship);
      if (result.status === "ELIGIBLE") {
        eligible.push(result);
      } else if (result.status === "NEEDS_REVIEW") {
        needsReview.push(result);
      } else if (result.status === "NOT_ELIGIBLE") {
        const near = asNearMatch(result);
        if (near !== null) nearMatches.push(near);
        // remaining NOT_ELIGIBLE records are simply not shown
      }
    }

    // Matching must not wait for one Gemini request per scholarship.
    // Use the deterministic, data-grounded explanation for bulk results;
    // Gemini remains available for on-demand detail explanations.
    for (const group of [eligible, nearMatches, needsReview]) {
      for (const result of group) {
        result.explanation = explanationService.templateExplanation(
          profile,
          result.scholarship,
          result.checks,
          result.status,
          result.missing,
          profile.lang
        );
      }
    }

    res.json({
      profile: {
        cgpa: profile.cgpa,
        department: profile.department,
        financial_support_needed: profile.financial_support_needed,
        gender: profile.gender,
      },
      summary: {
        eligible_count: eligible.length,
        near_match_count: nearMatches.length,
        needs_review_count: needsReview.length,
        records_checked: dataset.length,
      },
      eligible: sortResults(eligible, sortBy).map(resultToDict),
      near_matches: sortResults(nearMatches, sortBy).map(resultToDict),
      needs_review: sortResults(needsReview, sortBy).map(resultToDict),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.sortResults = sortResults;
