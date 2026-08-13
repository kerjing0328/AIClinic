from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from backend.app.services.supabase_conn import create_patient, create_doctor


router = APIRouter(
    tags=["Patients & Doctors"]
)

# REQUEST MODELS
class CreatePatientRequest(BaseModel):
    patient_ic: str
    name: str
    phone: str
    address: str


class CreateDoctorRequest(BaseModel):
    name: str
    email: EmailStr
    specialization: Optional[str] = ""


# CREATE PATIENT
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

# CREATE DOCTOR
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