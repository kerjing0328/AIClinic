"""
consultation_pipeline.py
------------------------
Manages the consultation lifecycle through status stages:

  1. draft          -> create row (patient_id, doctor_id, created_at, updated_at)
  2. transcribed    -> update transcript (path) + updated_at
  3. ai_extracted   -> update extracted_data (JSON, with demographics) + updated_at
  4. ai_reviewed    -> update ai_review (JSON) + updated_at
  5. note_generated -> update final_note (placeholder JSON) + updated_at
  6. doctor_approved  -> update final_note (reviewed JSON) + updated_at

"""

import json
from datetime import datetime
from typing import Any, Optional
from app.services.supabase_conn import get_patient_demographics, insert_row, update_row, get_consultation
from app.services.extract_structured import extract_structured
from app.services.consultation_review import review_consultation


def load_consultation_json(file_path: str) -> dict:
    """Read the structured consultation JSON from a file."""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_consultation_json(consultation_json: dict, file_path: str) -> None:
    """Write the updated consultation JSON back to a file."""
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(consultation_json, f, indent=2, ensure_ascii=False)

# Demographics injection
def inject_demographics(consultation_json: dict, patient_id: Any) -> dict:
    """
    Fetch and inject age and gender directly into the extracted_data block.

    Args:
        consultation_json : the structured transcript JSON (dict)
        patient_id        : patient id used ONLY to look up demographics
                            (not written into the JSON)

    Returns:
        The updated consultation_json.

    Raises:
        ValueError if demographics cannot be found for the patient.
    """
    # 1. Fetch demographics (age + gender only — LLM-safe)
    demo = get_patient_demographics(patient_id)
    if not demo:
        raise ValueError(f"No demographics found for patient_id={patient_id}")

    # 2. Inject age and gender 
    consultation_json["age"] = demo.get("age")
    consultation_json["gender"] = demo.get("gender")

    return consultation_json


# ---------------------------------------------------------------------------
# STAGE 1 — draft: create a new consultation row
# ---------------------------------------------------------------------------

def create_draft(patient_id: Any, doctor_id: Any) -> dict:
    """
    Create a new consultation row with status = 'draft'.
    Only IDs and timestamps are set at this stage.
    """
    now = datetime.now().isoformat()
    row = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    return insert_row("consultations", row)


# ---------------------------------------------------------------------------
# STAGE 2 — transcribed: attach transcript path
# ---------------------------------------------------------------------------

def set_transcribed(consultation_id: Any, transcript_path: str, transcript_content: str = "") -> dict:
    """
    Update the transcript column with the transcript file path.
    Also stores the full transcript text so it can be read back on resume.
    Advances status to 'transcribed'.
    """
    data = {
        "transcript": transcript_path,
        "transcript_content": transcript_content,
        "status": "transcribed",
        "updated_at": datetime.now().isoformat(),
    }
    return update_row("consultations", consultation_id, data, id_column="id")

# ---------------------------------------------------------------------------
# STAGE 3 — ai_extracted: extract structured data
# ---------------------------------------------------------------------------
def set_ai_extracted(consultation_id: Any) -> dict:
    """
    Extract structured consultation data from the transcript,
    inject demographics, save to the consultation, and update status.
    """

    consultation = get_consultation(consultation_id)

    if not consultation:
        return {}

    transcript_path = consultation.get("transcript")
    patient_id = consultation.get("patient_id")

    if not transcript_path:
        raise ValueError("Consultation has no transcript")

    structured_data = extract_structured(transcript_path)

    structured_data_with_demographics = inject_demographics(
        structured_data,
        patient_id
    )

    data = {
        "extracted_data": structured_data_with_demographics,
        "status": "ai_extracted",
        "updated_at": datetime.now().isoformat(),
    }

    return update_row(
        "consultations",
        consultation_id,
        data,
        id_column="id"
    )


# ---------------------------------------------------------------------------
# STAGE 4 — ai_reviewed: run AI review and store result
# ---------------------------------------------------------------------------

def save_extracted_data(consultation_id: Any, extracted_data: dict) -> dict:
    """
    Save edited extracted_data without changing status.
    Called before AI review so the reviewer sees the latest edits.
    """
    data = {
        "extracted_data": extracted_data,
        "updated_at": datetime.now().isoformat(),
    }
    return update_row("consultations", consultation_id, data, id_column="id")


def set_ai_reviewed(consultation_id: Any) -> dict:
    """
    Run the AI clinical review on the extracted_data, store the review
    result, and update status to 'ai_reviewed'.
    """
    consultation = get_consultation(consultation_id)

    if not consultation:
        raise ValueError("Consultation not found")

    extracted_data = consultation.get("extracted_data")
    if not extracted_data or not isinstance(extracted_data, dict):
        raise ValueError("Consultation has no extracted data to review")

    # Call the review service (Gemini + medical references).
    review_result = review_consultation({"extracted_data": extracted_data})
    print(f"AI review result: {review_result}")

    data = {
        "ai_review": review_result,
        "status": "ai_reviewed",
        "updated_at": datetime.now().isoformat(),
    }

    return update_row(
        "consultations",
        consultation_id,
        data,
        id_column="id"
    )

# ---------------------------------------------------------------------------
# STAGE 5 — doctor_approved: update final_note with reviewed content
# ---------------------------------------------------------------------------
def set_doctor_approved(consultation_id: Any, extracted_data: dict) -> dict:
    """
    Update the extracted_data column with the doctor-reviewed JSON.
    Advances status to 'doctor_approved'.
    """
    data = {
        "extracted_data": extracted_data,
        "status": "doctor_approved",
        "updated_at": datetime.now().isoformat(),
    }
    return update_row("consultations", consultation_id, data, id_column="id")


# ---------------------------------------------------------------------------
# Run — full lifecycle demo
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # ---- Predefined config ----
    TRANSCRIPT_PATH = "transcript01.txt"
    # OUTPUT_FILE = "structured_consultation_with_demographics.json"
    PATIENT_ID = "0e1e1e51-53e8-46b8-b838-33c51a9e6dbd"
    DOCTOR_ID = "0d015dcf-1e50-4f4b-b855-4ca612f2e198"

    consultation_id = None

    def print_menu():
        print("\n" + "=" * 45)
        print("  CONSULTATION LIFECYCLE MENU")
        print("=" * 45)
        print(f"  Current consultation id: {consultation_id or '(none - run Stage 1 first)'}")
        print("-" * 45)
        print("  1. draft          - create new consultation row")
        print("  2. transcribed    - attach transcript path")
        print("  3. ai_extracted   - inject demographics + extracted_data")
        print("  4. ai_reviewed    - run AI review + store result")
        print("  5. note_generated - attach placeholder final_note")
        print("  6. doctor_approved  - update reviewed final_note")
        print("  0. Exit")
        print("=" * 45)

    while True:
        print_menu()
        choice = input("Enter stage (0-6): ").strip()

        try:
            # ---- Exit ----
            if choice == "0":
                print("Exiting.")
                break

            # ---- STAGE 1: draft ----
            elif choice == "1":
                draft = create_draft(PATIENT_ID, DOCTOR_ID)
                consultation_id = draft.get("id")
                print(f"[draft] created row id={consultation_id}")

            # ---- Guard: stages 2-6 need a consultation_id ----
            elif choice in {"2", "3", "4", "5", "6"} and not consultation_id:
                print("⚠️  Please run Stage 1 (draft) first to create a consultation.")

            # ---- STAGE 2: transcribed ----
            elif choice == "2":
                set_transcribed(consultation_id, TRANSCRIPT_PATH)
                print(f"[transcribed]    transcript set -> {TRANSCRIPT_PATH}")

            # ---- STAGE 3: ai_extracted ----
            elif choice == "3":
                data = set_ai_extracted(consultation_id)
                print(f"[ai_extracted]   extracted_data set "
                      f"(age={data['extracted_data']['age']}, "
                      f"gender={data['extracted_data']['gender']})")

            # ---- STAGE 4: ai_reviewed ----
            elif choice == "4":
                result = set_ai_reviewed(consultation_id)
                print(f"[ai_reviewed]    review stored "
                      f"(risk={result.get('ai_review', {}).get('review', {}).get('overall_risk', '?')})")


            # ---- STAGE 5: doctor_approved ----
            elif choice == "6":
                reviewed = {
                    "final_note": {
                        "clinical_note": {
                            "subjective": "Patient reports cough and sore throat for 5 days.",
                            "objective": "Vitals stable; throat mildly red; chest clear.",
                            "assessment": "Viral upper respiratory tract infection.",
                            "plan": "Supportive care; safety-netting advice given.",
                        }
                    }
                }
                set_doctor_approved(consultation_id, reviewed)
                print(f"[doctor_approved]  final_note updated")

            # ---- Invalid ----
            else:
                print("Invalid choice. Please enter a number from 0 to 6.")

        except FileNotFoundError:
            print(f"Input file not found: {TRANSCRIPT_PATH}")
        except Exception as e:
            print("Stage failed:", e)