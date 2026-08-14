from typing import Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel


from app.services.consultation_pipeline import (
    create_draft,
    set_transcribed,
    set_ai_extracted,
    set_note_generated,
    set_doctor_approved,
    get_consultation
)

from app.services.supabase_conn import get_patient, update_row

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

class DoctorApprovedRequest(BaseModel):
    extracted_data: dict[str, Any]

# ===========================================================================
# GET SINGLE CONSULTATION  (used by the frontend to read ai_extracted json)
# ===========================================================================
@router.get("/{consultation_id}")
def get_consultation_endpoint(consultation_id: str):
    """Fetch a single consultation record (including the ai_extracted json)."""
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")
        return {"success": True, "consultation": consultation}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
      
# ===========================================================================
# STAGE 1 — DRAFT
# ===========================================================================
@router.post("", status_code=201)
def create_consultation(request: CreateConsultationRequest):
    """
    Create a new consultation.

    Status: draft
    """
    try:
        patient = get_patient(request.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

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
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# STAGE 2 — TRANSCRIBED
# ===========================================================================
@router.patch("/{consultation_id}/transcribed")
def mark_transcribed(consultation_id: str, request: TranscribedRequest):
    """
    Attach transcript path.

    Status: transcribed
    """
    try:
        result = set_transcribed(
            consultation_id=consultation_id,
            transcript_path=request.transcript_path,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Consultation not found")

        return {
            "success": True,
            "message": "Transcript attached",
            "status": "transcribed",
            "consultation": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# STAGE 3 — AI EXTRACTED
# ===========================================================================
@router.patch("/{consultation_id}/ai-extracted")
def mark_ai_extracted(consultation_id: str, background_tasks: BackgroundTasks):
    consultation = get_consultation(consultation_id)
    if not consultation:
        raise HTTPException(404, "Consultation not found")

    # Flip to an in-progress status right away
    update_row("consultations", consultation_id,
               {"status": "extracting"}, id_column="id")

    # Run the heavy work AFTER responding
    background_tasks.add_task(set_ai_extracted, consultation_id)

    return {"success": True, "status": "extracting"}  # returns in ms

# GET extracted without trigger again stage 3
@router.get("/{consultation_id}/ai-extracted")
def get_ai_extracted(consultation_id: str):
    try:
        consultation = get_consultation(consultation_id)

        if not consultation:
            raise HTTPException(
                status_code=404,
                detail="Consultation not found"
            )

        return {
            "success": True,
            "status": consultation.get("status"),
            "extracted_data": consultation.get("extracted_data"),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# ===========================================================================
# STAGE 4 — DOCTOR APPROVED
# ===========================================================================
@router.patch("/{consultation_id}/doctor-approved")
def mark_doctor_approved(consultation_id: str, request: DoctorApprovedRequest):
    """
    Save the doctor-edited final note and mark the consultation approved.

    Status: doctor_approved
    """
    try:
        result = set_doctor_approved(
            consultation_id=consultation_id,
            extracted_data=request.extracted_data,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Consultation not found")

        return {
            "success": True,
            "message": "Consultation approved",
            "status": "doctor_approved",
            "consultation": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
