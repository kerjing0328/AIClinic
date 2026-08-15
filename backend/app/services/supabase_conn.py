"""
supabase_conn.py
------------------
Reusable Supabase helper functions for the AI Clinical Assistant MVP.

Schema:
  patients      : id, patient_ic, name, age (auto), gender (auto), created_at, updated_at
  doctors       : id, name, email, specialization, created_at
  consultations : id, patient_id, doctor_id, consultation_date, consultation_type,
                  status, transcript, extracted_data (JSONB),
                  final_note (JSONB, dr approve), created_at, updated_at

Setup:
  pip install supabase python-dotenv
  .env must contain SUPABASE_URL and SUPABASE_KEY
"""

import os
from typing import Any, Optional
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError("Missing SUPABASE_URL or SUPABASE_KEY in .env file")

print("SUPABASE_URL:", SUPABASE_URL)
print("SUPABASE_KEY prefix:", SUPABASE_KEY[:15] if SUPABASE_KEY else None)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ===========================================================================
# GENERIC CRUD 
# ===========================================================================

def insert_row(table: str, data: dict) -> dict:
    """Insert a single row. Returns the inserted row (with generated id)."""
    try:
        response = supabase.table(table).insert(data).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"[insert_row] Error inserting into {table}: {e}")
        raise


def insert_many(table: str, rows: list[dict]) -> list[dict]:
    """Insert multiple rows at once. Returns the inserted rows."""
    try:
        response = supabase.table(table).insert(rows).execute()
        return response.data or []
    except Exception as e:
        print(f"[insert_many] Error inserting into {table}: {e}")
        raise


def get_all(table: str, columns: str = "*", limit: Optional[int] = None) -> list[dict]:
    """Fetch all rows from a table (optional limit)."""
    try:
        query = supabase.table(table).select(columns)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception as e:
        print(f"[get_all] Error fetching from {table}: {e}")
        raise


def get_by_id(table: str, row_id: Any, id_column: str = "id", columns: str = "*") -> Optional[dict]:
    """Fetch a single row by its primary key. Returns None if not found."""
    try:
        response = (
            supabase.table(table)
            .select(columns)
            .eq(id_column, row_id)
            .maybe_single()
            .execute()
        )
        return response.data if response else None
    except Exception as e:
        print(f"[get_by_id] Error fetching {row_id} from {table}: {e}")
        raise


def get_where(table: str, filters: dict, columns: str = "*") -> list[dict]:
    """
    Fetch rows matching equality filters.
    Example: get_where("consultations", {"doctor_id": 1, "status": "draft"})
    """
    try:
        query = supabase.table(table).select(columns)
        for column, value in filters.items():
            query = query.eq(column, value)
        response = query.execute()
        return response.data or []
    except Exception as e:
        print(f"[get_where] Error fetching from {table}: {e}")
        raise


def update_row(table: str, row_id: Any, data: dict, id_column: str = "id") -> dict:
    """Update a row by id. Returns the updated row."""
    try:
        response = (
            supabase.table(table)
            .update(data)
            .eq(id_column, row_id)
            .execute()
        )
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"[update_row] Error updating {row_id} in {table}: {e}")
        raise


def upsert_row(table: str, data: dict) -> dict:
    """Insert or update a row (based on primary key / unique constraint)."""
    try:
        response = supabase.table(table).upsert(data).execute()
        return response.data[0] if response.data else {}
    except Exception as e:
        print(f"[upsert_row] Error upserting into {table}: {e}")
        raise


def delete_row(table: str, row_id: Any, id_column: str = "id") -> bool:
    """Delete a row by id. Returns True if a row was deleted."""
    try:
        response = (
            supabase.table(table)
            .delete()
            .eq(id_column, row_id)
            .execute()
        )
        return bool(response.data)
    except Exception as e:
        print(f"[delete_row] Error deleting {row_id} from {table}: {e}")
        raise


def count_rows(table: str, filters: Optional[dict] = None) -> int:
    """Count rows in a table (optional filter)."""
    try:
        query = supabase.table(table).select("*", count="exact")
        if filters:
            for column, value in filters.items():
                query = query.eq(column, value)
        response = query.execute()
        return response.count or 0
    except Exception as e:
        print(f"[count_rows] Error counting {table}: {e}")
        raise


def exists(table: str, filters: dict) -> bool:
    """Check if at least one row matches the filters."""
    return count_rows(table, filters) > 0


# ===========================================================================
# HELPER  —  Derive age & gender from Malaysian IC  (YYMMDD-PB-###G)
# ===========================================================================

def derive_from_ic(ic: str) -> dict:
    """
    Derive age and gender from a Malaysian IC number.
    Format: YYMMDD-PB-###G  (e.g. '800315-14-5237')
      - YYMMDD  -> date of birth  -> age
      - last digit (G): odd = Male, even = Female
    Returns: {"age": int, "gender": str}
    """
    digits = "".join(c for c in ic if c.isdigit())
    if len(digits) != 12:
        raise ValueError(f"Invalid IC format: {ic}")

    yy = int(digits[0:2])
    mm = int(digits[2:4])
    dd = int(digits[4:6])
    last_digit = int(digits[11])

    # Century: 00–29 -> 2000s, else 1900s
    current_yy = datetime.now().year % 100
    full_year = 2000 + yy if yy <= current_yy else 1900 + yy

    dob = datetime(full_year, mm, dd)
    today = datetime.now()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    gender = "Female" if last_digit % 2 == 0 else "Male"
    return {"age": age, "gender": gender}


# ===========================================================================
# DOMAIN HELPERS  —  PATIENTS  (registered at reception; PII lives here)
# ===========================================================================

def create_patient(patient_ic: str, name: str, phone: str, address: str) -> dict:
    """
    Register a patient at reception.
    age and gender are AUTO-derived from the IC number.
    """
    demographics = derive_from_ic(patient_ic)
    data = {
        "patient_ic": patient_ic,        # PII — never sent to LLM
        "name": name,                    # PII — never sent to LLM
        "phone": phone,
        "address": address,
        "age": demographics["age"],      # auto-derived
        "gender": demographics["gender"],  # auto-derived
    }
    return insert_row("patients", data)


def get_patient(patient_id: Any) -> Optional[dict]:
    """Fetch a full patient record by id."""
    return get_by_id("patients", patient_id, id_column="id")


def get_patient_demographics(patient_id: Any) -> Optional[dict]:
    """
    Fetch ONLY non-identifying demographics (safe for LLM / red-flag logic).
    Excludes name and IC.
    """
    return get_by_id(
        "patients", patient_id, id_column="id", columns="age, gender"
    )


def update_patient(patient_id: Any, data: dict) -> dict:
    """Update a patient record. Re-derives age & gender if the IC changes."""
    data = dict(data)  # don't mutate caller's dict

    # If the IC is being updated, re-derive age & gender from it.
    if data.get("patient_ic"):
        demographics = derive_from_ic(data["patient_ic"])
        data["age"] = demographics["age"]
        data["gender"] = demographics["gender"]

    return update_row("patients", patient_id, data, id_column="id")


def delete_patient(patient_id: Any) -> bool:
    """Delete a patient by id."""
    return delete_row("patients", patient_id, id_column="id")


# ===========================================================================
# DOMAIN HELPERS  —  DOCTORS
# ===========================================================================

def create_doctor(name: str, email: str, specialization: str = "") -> dict:
    """Create a doctor record."""
    data = {"name": name, "email": email, "specialization": specialization}
    return insert_row("doctors", data)


def get_doctor(doctor_id: Any) -> Optional[dict]:
    """Fetch a doctor by id."""
    return get_by_id("doctors", doctor_id, id_column="id")


def get_doctor_by_email(email: str) -> Optional[dict]:
    """Fetch a doctor by email (login lookup)."""
    rows = get_where("doctors", {"email": email})
    return rows[0] if rows else None


# ===========================================================================
# DOMAIN HELPERS  —  CONSULTATIONS  (clinical content; NO direct PII)
# ===========================================================================

def create_consultation(patient_id: Any, doctor_id: Any, transcript: str,
                        extracted_data: dict,
                        consultation_type: str = "new") -> dict:
    """
    Create a new consultation (status = 'draft').
    Stores transcript + extracted_data (JSONB). final_note is filled on approval.
    """
    data = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "consultation_date": datetime.now().isoformat(),
        "consultation_type": consultation_type,
        "status": "draft",
        "transcript": transcript,
        "extracted_data": extracted_data,   # JSONB
        "final_note": None,
    }
    return insert_row("consultations", data)


def get_consultation(consultation_id: Any) -> Optional[dict]:
    """Fetch a single consultation by id."""
    return get_by_id("consultations", consultation_id, id_column="id")


def get_consultations_by_doctor(doctor_id: Any) -> list[dict]:
    """Fetch all consultations for a doctor."""
    return get_where("consultations", {"doctor_id": doctor_id})


def get_consultations_by_patient(patient_id: Any) -> list[dict]:
    """Fetch all consultations for a patient."""
    return get_where("consultations", {"patient_id": patient_id})


def approve_consultation(consultation_id: Any, final_note: dict,
                        patient_id: Any) -> dict:
    """
    Doctor approves the note.
    Snapshots demographics (age + gender) INTO the final_note for the LLM/record,
    saves the edited final_note, and sets status = 'approved'.
    """
    # Snapshot demographics at time of approval (point-in-time record)
    demographics = get_patient_demographics(patient_id) or {}
    final_note = dict(final_note)  # copy to avoid mutating caller's dict
    final_note["demographics"] = {
        "age": demographics.get("age"),
        "gender": demographics.get("gender"),
    }

    data = {
        "final_note": final_note,          # JSONB — doctor-approved record
        "status": "approved",
        "updated_at": datetime.now().isoformat(),
    }
    return update_row("consultations", consultation_id, data, id_column="id")

def delete_consultation(consultation_id: Any) -> bool:
    """Delete a consultation by id (demo/cleanup use)."""
    return delete_row("consultations", consultation_id, id_column="id")


# ===========================================================================
# DOMAIN HELPERS  —  MEDICAL REFERENCES
# ===========================================================================

def insert_medical_reference(data: dict) -> dict:
    """Insert a medical reference chunk if it does not already exist."""
    try:
        response = supabase.table("medical_references").upsert(
            data,
            on_conflict="chunk_hash",
            ignore_duplicates=True
        ).execute()

        return response.data[0] if response.data else {}

    except Exception as e:
        print(f"[insert_medical_reference] Error inserting medical reference: {e}")
        raise


def insert_medical_references(rows: list[dict]) -> list[dict]:
    """Insert multiple medical reference chunks while ignoring duplicates."""
    if not rows:
        return []

    try:
        response = supabase.table("medical_references").upsert(
            rows,
            on_conflict="chunk_hash",
            ignore_duplicates=True
        ).execute()

        return response.data or []

    except Exception as e:
        print(f"[insert_medical_references] Error inserting medical references: {e}")
        raise


def match_medical_references(
    query_embedding: list[float],
    match_threshold: float = 0.5,
    match_count: int = 5
) -> list[dict]:
    """Find semantically similar medical reference chunks."""
    try:
        response = supabase.rpc(
            "match_medical_references",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count
            }
        ).execute()

        return response.data or []

    except Exception as e:
        print(f"[match_medical_references] Error searching medical references: {e}")
        raise


# ===========================================================================
# Testing code block
# ===========================================================================
if __name__ == "__main__":
    print("\nSupabase client initialised successfully.")

    # -----------------------------------------------------------------------
    # 1. IC derivation 
    # -----------------------------------------------------------------------
    print("\n--- IC Derivation Test ---")
    print("IC 800315-14-5237 ->", derive_from_ic("800315-14-5237"))
    print("IC 900722-08-6148 ->", derive_from_ic("900722-08-6148"))

    # -----------------------------------------------------------------------
    # 2. create a patient in database (age + gender auto-derived from IC)
    # -----------------------------------------------------------------------
    print("\n--- Create Patient Test (writes to DB) ---")
    try:
        new_patient = create_patient(
            patient_ic="030101-01-0123",
            name="Sia",
            phone="0121234567",
            address="123, Jalan Gembira, Sitiawan."
        )
        print("Inserted patient:", new_patient)

        patient_id = new_patient.get("id")

        # 2a. Read it back by id
        fetched = get_patient(patient_id)
        print("Fetched patient:", fetched)

        # 2b. Read demographics only (safe for LLM — no name/IC)
        demo = get_patient_demographics(patient_id)
        print("Demographics only (LLM-safe):", demo)

        # 2c. Count patients in the table
        print("Total patients in table:", count_rows("patients"))

        # # 2d. Clean up: delete the test patient (comment out to keep it)
        # deleted = delete_row("patients", patient_id, id_column="id")
        # print("Test patient deleted:", deleted)

    except Exception as e:
        print("DB test failed:", e)
