"""
consultation_report.py

Generates a downloadable PDF report for an approved consultation.

Endpoint:
    GET /consultations/{consultation_id}/report

Uses reportlab (pure-Python, no system deps). If you don't have it:
    pip install reportlab

Register in main.py:
    from app.routers import consultation_report
    app.include_router(consultation_report.router)
"""

from io import BytesIO
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.supabase_conn import get_consultation, get_patient

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)

router = APIRouter(
    prefix="/consultations",
    tags=["Consultation Report"],
)

# Brand colours (match design.md)
PRIMARY = colors.HexColor("#065F46")
MUTED = colors.HexColor("#6B7280")
LIGHT = colors.HexColor("#D1FAE5")


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _pretty(label: str) -> str:
    return label.replace("_", " ").strip().title()


def _stringify(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, list):
        return ", ".join(str(v) for v in value) if value else "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    s = str(value).strip()
    return s if s else "—"


def _flatten_leaf(obj: dict, prefix: str = "") -> list[tuple[str, str]]:
    """Flatten a nested dict into (label, value) pairs for leaf fields only."""
    rows: list[tuple[str, str]] = []
    for k, v in obj.items():
        if isinstance(v, dict):
            rows.extend(_flatten_leaf(v, prefix=f"{prefix}{k} › " if prefix else f"{k} › "))
        elif isinstance(v, list):
            rows.append((_pretty(prefix + k), _stringify(v)))
        else:
            rows.append((_pretty(prefix + k), _stringify(v)))
    return rows


# --------------------------------------------------------------------------
# SOAP-ordered extraction
# --------------------------------------------------------------------------

# Display order for fields within each SOAP section
_SUBJECTIVE_ORDER = [
    "history", "onset", "duration", "progression", "severity",
    "symptoms", "relevant_negatives", "medical_history",
    "medications", "allergies", "social_history",
]

_OBJECTIVE_ORDER = [
    "vital_signs", "examination", "findings",
]

_ASSESSMENT_ORDER = [
    "diagnosis", "clinical_impression",
]

_PLAN_ORDER = [
    "medications", "treatment", "referral",
    "follow_up", "safety_netting", "patient_instructions",
]


def _ordered_fields(data: dict, order: list[str]) -> list[tuple[str, str]]:
    """Return fields from data in the specified order, then any extras."""
    seen = set()
    rows: list[tuple[str, str]] = []

    for key in order:
        if key in data:
            seen.add(key)
            val = data[key]
            if isinstance(val, dict):
                # Flatten nested dicts (e.g. vital_signs) without repeating parent label
                rows.extend(_flatten_leaf(val, prefix=""))
            else:
                rows.append((_pretty(key), _stringify(val)))

    # Any remaining keys not in the order list
    for key, val in data.items():
        if key not in seen:
            if isinstance(val, dict):
                rows.extend(_flatten_leaf(val, prefix=""))
            else:
                rows.append((_pretty(key), _stringify(val)))

    return rows


def _iter_soap(note: dict):
    """
    Yield (section_heading, [(field_label, value_str), ...]) in SOAP order.
    """
    # Top-level demographics / metadata
    top_level = {k: v for k, v in note.items()
                 if k not in ("SOAP", "investigations") and not isinstance(v, dict)}
    if top_level:
        rows = [((_pretty(k), _stringify(v))) for k, v in top_level.items()]
        yield "Details", rows

    soap = note.get("SOAP", note)  # fallback to root if no SOAP key

    # Subjective
    subjective = soap.get("subjective", {})
    if subjective:
        yield "Subjective", _ordered_fields(subjective, _SUBJECTIVE_ORDER)

    # Objective
    objective = soap.get("objective", {})
    if objective:
        yield "Objective", _ordered_fields(objective, _OBJECTIVE_ORDER)

    # Assessment
    assessment = soap.get("assessment", {})
    if assessment:
        yield "Assessment", _ordered_fields(assessment, _ASSESSMENT_ORDER)

    # Plan
    plan = soap.get("plan", {})
    if plan:
        yield "Plan", _ordered_fields(plan, _PLAN_ORDER)

    # Investigations (outside SOAP)
    investigations = note.get("investigations", {})
    if investigations:
        yield "Investigations", _ordered_fields(investigations, ["ordered", "results"])


# --------------------------------------------------------------------------
# PDF builder
# --------------------------------------------------------------------------
def _build_pdf(consultation: dict, patient: dict | None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Consultation Report",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=PRIMARY, fontSize=20, spaceAfter=2)
    small = ParagraphStyle("small", parent=styles["Normal"], textColor=MUTED, fontSize=9)
    group = ParagraphStyle("group", parent=styles["Heading2"], textColor=PRIMARY, fontSize=12, spaceBefore=10, spaceAfter=4)
    cell_label = ParagraphStyle("cl", parent=styles["Normal"], textColor=MUTED, fontSize=9)
    cell_value = ParagraphStyle("cv", parent=styles["Normal"], fontSize=10, leading=13)

    story: list = []

    # ---- Header
    story.append(Paragraph("Consultation Report", h1))
    story.append(Paragraph("Notedr.", small))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT))
    story.append(Spacer(1, 8))

    # ---- Meta (patient + consultation)
    cid = consultation.get("consultation_id") or consultation.get("id") or "—"
    status = consultation.get("status", "—")
    approved_at = consultation.get("updated_at") or consultation.get("created_at") or ""
    meta_rows = [
        ["Consultation ID", str(cid), "Status", str(status)],
        [
            "Patient",
            (patient or {}).get("name", "—"),
            "IC",
            (patient or {}).get("patient_ic", "—"),
        ],
        # [
        #     "Age",
        #     str((patient or {}).get("age", "—")),
        #     "Gender",
        #     str((patient or {}).get("gender", "—")),
        # ],
        ["Date", _fmt_date(approved_at), "", ""],
    ]
    meta = Table(meta_rows, colWidths=[28 * mm, 60 * mm, 24 * mm, 55 * mm])
    meta.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
                ("TEXTCOLOR", (2, 0), (2, -1), MUTED),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(meta)
    story.append(Spacer(1, 8))

    # ---- Clinical content (from the doctor-approved final note)
    note = (
        consultation.get("final_note")
        or consultation.get("extracted_data")
        or consultation.get("ai_extracted")
        or {}
    )
    # unwrap { extracted_data: {...} }
    if isinstance(note, dict) and set(note.keys()) == {"extracted_data"}:
        note = note["extracted_data"]

    if not isinstance(note, dict) or not note:
        story.append(Paragraph("No clinical data available.", small))
    else:
        for heading, rows in _iter_soap(note):
            if not rows:
                continue

            story.append(Paragraph(heading, group))
            story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT))
            story.append(Spacer(1, 4))

            table_rows = [
                [Paragraph(lbl, cell_label), Paragraph(val, cell_value)]
                for lbl, val in rows
            ]
            t = Table(table_rows, colWidths=[55 * mm, 112 * mm])
            t.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LINEBELOW", (0, 0), (-1, -2), 0.25, colors.HexColor("#EEEEEE")),
                    ]
                )
            )
            story.append(t)
            story.append(Spacer(1, 6))

    # ---- Footer note
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT))
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')} · "
            "This document is a doctor-approved clinical record.",
            small,
        )
    )

    doc.build(story)
    return buf.getvalue()


def _fmt_date(value: str) -> str:
    if not value:
        return "—"
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        return str(value)


# --------------------------------------------------------------------------
# Endpoint
# --------------------------------------------------------------------------
@router.get("/{consultation_id}/report")
def download_consultation_report(consultation_id: str):
    """
    Return the approved consultation as a formatted PDF (inline/attachment).
    """
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        # Optional: enrich with patient info for the header
        patient = None
        pid = consultation.get("patient_id")
        if pid is not None:
            try:
                patient = get_patient(pid)
            except Exception:
                patient = None

        pdf_bytes = _build_pdf(consultation, patient)

        filename = f"consultation_{consultation_id}_report.pdf"
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
