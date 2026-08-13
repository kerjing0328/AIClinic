from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.consultation_pipeline import (
    create_draft,
    set_transcribed,
    set_ai_extracted,
    set_note_generated,
    set_doctor_approved,
)

from backend.app.services.supabase_conn import get_patient

router = APIRouter(
    prefix="/consultations",
    tags=["Consultations Stages"],
)


# REQUEST MODELS
class CreateConsultationRequest(BaseModel):
    patient_id: str
    doctor_id: str


class TranscribedRequest(BaseModel):
    transcript_path: str


class AIExtractedRequest(BaseModel):
    extracted_json: dict[str, Any]


# STAGE 1 — DRAFT
@router.post("", status_code=201)
def create_consultation(request: CreateConsultationRequest):
    """
    Create a new consultation.

    Status:
        draft

    Creates:
        patient_id
        doctor_id
        created_at
        updated_at
    """

    try:
        # Verify patient exists
        patient = get_patient(request.patient_id)

        if not patient:
            raise HTTPException(
                status_code=404,
                detail="Patient not found",
            )

        result = create_draft(
            patient_id=request.patient_id,
            doctor_id=request.doctor_id,
        )

        return {
            "success": True,
            "message": "Consultation created",
            "status": "draft",
            "consultation": result,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# STAGE 2 — TRANSCRIBED
@router.patch("/{consultation_id}/transcribed")
def mark_transcribed(
    consultation_id: str,
    request: TranscribedRequest,
):
    """
    Attach transcript path.

    Status:
        transcribed
    """

    try:
        result = set_transcribed(
            consultation_id=consultation_id,
            transcript_path=request.transcript_path,
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Consultation not found",
            )

        return {
            "success": True,
            "message": "Transcript attached",
            "status": "transcribed",
            "consultation": result,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# STAGE 3 — AI EXTRACTED
@router.patch("/{consultation_id}/ai-extracted")
def mark_ai_extracted(
    consultation_id: str,
    request: AIExtractedRequest,
):
    """
    Store AI-extracted consultation data.

    Status:
        ai_extracted

    The extracted JSON should already contain
    the injected demographics.
    """

    try:
        result = set_ai_extracted(
            consultation_id=consultation_id,
        )

        if not result:
            raise HTTPException(
                status_code=404,
                detail="Consultation not found",
            )

        return {
            "success": True,
            "message": "AI extracted data saved",
            "status": "ai_extracted",
            "consultation": result,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )