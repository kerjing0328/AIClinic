from typing import Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.services.supabase_conn import (
    create_patient,
    create_doctor,
    get_patient,
    get_doctor,
    get_doctor_by_email,
    get_all,
    update_patient,
    get_consultations_by_patient,
)


router = APIRouter(
    tags=["Patients & Doctors"]
)


# ===========================================================================
# REQUEST MODELS
# ===========================================================================
class CreatePatientRequest(BaseModel):
    patient_ic: str
    name: str
    phone: str
    address: str


class CreateDoctorRequest(BaseModel):
    name: str
    email: EmailStr
    specialization: Optional[str] = ""

class UpdatePatientRequest(BaseModel):
    patient_ic: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class DoctorSignInRequest(BaseModel):
    email: EmailStr

# ===========================================================================
# CREATE PATIENT
# ===========================================================================
@router.post("/patients", status_code=201)
def create_patient_endpoint(request: CreatePatientRequest):
    """
    Register a new patient.

    Age and gender are automatically derived from the Malaysian IC.
    """
    try:
        patient = create_patient(
            patient_ic=request.patient_ic,
            name=request.name,
            phone=request.phone,
            address=request.address,
        )

        return {
            "success": True,
            "message": "Patient created successfully",
            "patient": patient,
        }

    except ValueError as e:
        # Invalid IC format / invalid date
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ===========================================================================
# CREATE DOCTOR
# ===========================================================================
@router.post("/doctors", status_code=201)
def create_doctor_endpoint(request: CreateDoctorRequest):
    """
    Register a new doctor.
    """
    try:
        doctor = create_doctor(
            name=request.name,
            email=request.email,
            specialization=request.specialization or "",
        )

        return {
            "success": True,
            "message": "Doctor created successfully",
            "doctor": doctor,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ===========================================================================
# GET ALL PATIENTS
# ===========================================================================
@router.get("/patients")
def get_patients_endpoint(limit: Optional[int] = None):
    """
    Fetch all patients.

    Optional query param `limit` caps the number of rows returned,
    e.g. GET /patients?limit=20
    """
    try:
        patients = get_all("patients", limit=limit)

        return {
            "success": True,
            "count": len(patients),
            "patients": patients,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ===========================================================================
# GET SINGLE PATIENT (by id)
# ===========================================================================
@router.get("/patients/{patient_id}")
def get_patient_endpoint(patient_id: int):
    """
    Fetch a single patient record by id.
    """
    try:
        patient = get_patient(patient_id)

        if not patient:
            raise HTTPException(
                status_code=404,
                detail=f"Patient {patient_id} not found",
            )

        return {
            "success": True,
            "patient": patient,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# ===========================================================================
# GET ALL DOCTORS
# ===========================================================================
@router.get("/doctors")
def get_doctors_endpoint(limit: Optional[int] = None):
    """
    Fetch all doctors.

    Optional query param `limit` caps the number of rows returned,
    e.g. GET /doctors?limit=20
    """
    try:
        doctors = get_all("doctors", limit=limit)

        return {
            "success": True,
            "count": len(doctors),
            "doctors": doctors,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ===========================================================================
# GET SINGLE DOCTOR (by id)
# ===========================================================================
@router.get("/doctors/{doctor_id}")
def get_doctor_endpoint(doctor_id: int):
    """
    Fetch a single doctor record by id.
    """
    try:
        doctor = get_doctor(doctor_id)

        if not doctor:
            raise HTTPException(
                status_code=404,
                detail=f"Doctor {doctor_id} not found",
            )

        return {
            "success": True,
            "doctor": doctor,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

# ============================================================
# UPDATE PATIENT
# ============================================================
@router.put("/patients/{patient_id}")
def update_patient_endpoint(patient_id: Any, request: UpdatePatientRequest):
    """
    Update an existing patient.

    Only the provided fields are changed. If the IC changes,
    age and gender are re-derived server-side.
    """
    # Drop keys the caller didn't send so we only patch provided fields.
    changes = {k: v for k, v in request.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        patient = update_patient(patient_id, changes)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return {
            "success": True,
            "message": "Patient updated successfully",
            "patient": patient,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# GET CONSULTATIONS FOR A PATIENT
# ============================================================
@router.get("/patients/{patient_id}/consultations")
def get_patient_consultations_endpoint(patient_id: Any):
    """Return all consultations linked to a given patient."""
    try:
        consultations = get_consultations_by_patient(patient_id)
        return {"success": True, "consultations": consultations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===========================================================================
# DOCTOR SIGN IN
# ===========================================================================
@router.post("/doctors/signin")
def signin_doctor_endpoint(request: DoctorSignInRequest):
    """
    Sign in a doctor by email.

    Looks up the doctor record by email and returns it so the frontend
    can record the signed-in doctor_id in the session.
    """
    try:
        doctor = get_doctor_by_email(request.email)

        if not doctor:
            raise HTTPException(
                status_code=401,
                detail="No doctor found with that email.",
            )

        return {"success": True, "doctor": doctor}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))