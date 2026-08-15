import json
import os
import tempfile
from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


from app.services.consultation_pipeline import (
    create_draft,
    set_transcribed,
    set_ai_extracted,
    save_extracted_data,
    set_ai_reviewed,
    set_doctor_approved,
    get_consultation,
)
from app.services.speech_text import transcribe_audio_stream

from app.services.supabase_conn import get_patient, update_row, delete_consultation

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
    transcript_content: str = ""


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
# DELETE CONSULTATION
# ===========================================================================
@router.delete("/{consultation_id}")
def delete_consultation_endpoint(consultation_id: str):
    """Delete a consultation by id."""
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        deleted = delete_consultation(consultation_id)
        if not deleted:
            raise HTTPException(status_code=500, detail="Failed to delete consultation")

        return {
            "success": True,
            "message": "Consultation deleted successfully",
        }
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
            transcript_content=request.transcript_content,
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
# STAGE 4 — AI REVIEWED
# ===========================================================================

@router.patch("/{consultation_id}/extracted-data")
def update_extracted_data(consultation_id: str, request: AIExtractedRequest):
    """
    Save edited extracted_data without changing status.
    Used before AI review to persist the doctor's field edits.
    """
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        result = save_extracted_data(consultation_id, request.extracted_json)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save extracted data")

        return {
            "success": True,
            "message": "Extracted data saved",
            "status": consultation.get("status"),
            "consultation": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{consultation_id}/ai-review")
def generate_ai_review(consultation_id: str):
    """
    Run the AI clinical review on the extracted data and store the result.

    Status: ai_reviewed
    """
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        result = set_ai_reviewed(consultation_id)
        if not result:
            raise HTTPException(status_code=500, detail="AI review failed")

        return {
            "success": True,
            "message": "AI review completed",
            "status": "ai_reviewed",
            "review": result.get("ai_review"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{consultation_id}/ai-review")
def get_ai_review(consultation_id: str):
    """
    Fetch the stored AI review for a consultation (read-only).
    """
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        return {
            "success": True,
            "status": consultation.get("status"),
            "review": consultation.get("ai_review"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===========================================================================
# STAGE 5 — DOCTOR APPROVED
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


# ===========================================================================
# AUDIO TRANSCRIPTION — SSE streaming
# ===========================================================================
@router.post("/{consultation_id}/transcribe-audio")
async def transcribe_audio(consultation_id: str, file: UploadFile = File(...)):
    """
    Upload an audio file and stream back the transcription via SSE.

    Returns a ``text/event-stream`` response.  Each event is a JSON object:
      ``{"line": "doctor: ..."}``  – a complete transcription line
      ``{"done": true, "transcript": "..."}``  – stream finished
    """
    try:
        consultation = get_consultation(consultation_id)
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")

        suffix = Path(file.filename).suffix if file.filename else ".mp3"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=tempfile.gettempdir())
        try:
            content = await file.read()
            tmp.write(content)
            tmp.close()
            audio_path = tmp.name

            def event_generator():
                lines: list[str] = []
                try:
                    for line in transcribe_audio_stream(audio_path):
                        lines.append(line)
                        yield f"data: {json.dumps({'line': line})}\n\n"

                    transcript_text = "\n".join(lines)
                    set_transcribed(
                        consultation_id=consultation_id,
                        transcript_path=file.filename or f"audio{suffix}",
                        transcript_content=transcript_text,
                    )
                    yield f"data: {json.dumps({'done': True, 'transcript': transcript_text})}\n\n"
                except Exception as exc:
                    yield f"data: {json.dumps({'error': str(exc)})}\n\n"
                finally:
                    try:
                        os.unlink(audio_path)
                    except OSError:
                        pass

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        except Exception:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass
            raise

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
