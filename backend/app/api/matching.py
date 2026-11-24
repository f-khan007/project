from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..models.student import StudentProfile
from ..services import explanation_service
from ..services.eligibility_engine import evaluate
from ..services.near_match import as_near_match

router = APIRouter()


class MatchRequest(StudentProfile):
    sort_by: str = Field(default="deadline", pattern="^(deadline|amount|name)$")


def _sort_key_deadline(result):
    d = result.scholarship.deadline
    return (d is None, d.toordinal() if d else 0, result.scholarship.name.casefold())


def _sort_key_amount(result):
    a = result.scholarship.amount_bdt
    return (a is None, -(a or 0), result.scholarship.name.casefold())


def sort_results(results: list, sort_by: str) -> list:
    if sort_by == "amount":
        return sorted(results, key=_sort_key_amount)
    if sort_by == "name":
        return sorted(results, key=lambda r: r.scholarship.name.casefold())
    return sorted(results, key=_sort_key_deadline)  # deadline default, missing last


@router.post("/api/match")
def match(payload: MatchRequest, request: Request):
    profile = StudentProfile(**payload.model_dump(exclude={"sort_by"}))
    dataset = request.app.state.dataset

    eligible, near_matches, needs_review = [], [], []
    for scholarship in dataset:
        result = evaluate(profile, scholarship)
        if result.status == "ELIGIBLE":
            eligible.append(result)
        elif result.status == "NEEDS_REVIEW":
            needs_review.append(result)
        elif result.status == "NOT_ELIGIBLE":
            near = as_near_match(result)
            if near is not None:
                near_matches.append(near)
            # remaining NOT_ELIGIBLE records are simply not shown

    # Do not block bulk matching on one Gemini request per scholarship.
    # Use deterministic, data-grounded explanations in the results list;
    # Gemini remains available for on-demand detail explanations.
    for group in (eligible, near_matches, needs_review):
        for result in group:
            result.explanation = explanation_service.template_explanation(
                profile, result.scholarship, result.checks,
                result.status, result.missing, profile.lang,
            )

    return {
        "profile": {
            "cgpa": profile.cgpa,
            "department": profile.department,
            "financial_support_needed": profile.financial_support_needed,
            "gender": profile.gender.value,
        },
        "summary": {
            "eligible_count": len(eligible),
            "near_match_count": len(near_matches),
            "needs_review_count": len(needs_review),
            "records_checked": len(dataset),
        },
        "eligible": [r.to_dict() for r in sort_results(eligible, payload.sort_by)],
        "near_matches": [r.to_dict() for r in sort_results(near_matches, payload.sort_by)],
        "needs_review": [r.to_dict() for r in sort_results(needs_review, payload.sort_by)],
    }
