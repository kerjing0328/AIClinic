"""
inject_demographics.py
----------------------
Reads a structured consultation JSON, then fetches age and sex from the
patients table and injects them directly into the extracted_data block —
WITHOUT exposing name or IC (LLM-safe).
"""

import json
from typing import Any, Optional
from supabaseconn import get_patient_demographics 


def load_consultation_json(file_path: str) -> dict:
    """Read the structured consultation JSON from a file."""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_consultation_json(consultation_json: dict, file_path: str) -> None:
    """Write the updated consultation JSON back to a file."""
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(consultation_json, f, indent=2, ensure_ascii=False)


def inject_demographics(consultation_json: dict, patient_id: Any) -> dict:
    """
    Fetch and inject age and sex directly into the extracted_data block.

    Args:
        consultation_json : the structured transcript JSON (dict)
        patient_id        : patient id used ONLY to look up demographics
                            (not written into the JSON)

    Returns:
        The updated consultation_json.

    Raises:
        ValueError if demographics cannot be found for the patient.
    """
    extracted_data = consultation_json.setdefault("extracted_data", {})

    # 1. Fetch demographics (age + gender only — LLM-safe)
    demo = get_patient_demographics(patient_id)
    if not demo:
        raise ValueError(f"No demographics found for patient_id={patient_id}")

    # 2. Inject age and sex directly (DB 'gender' -> JSON 'sex')
    extracted_data["age"] = demo.get("age")
    extracted_data["sex"] = demo.get("gender")

    return consultation_json


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # ---- Predefined values ----
    INPUT_FILE = "structured_consultation.json"          # source JSON file
    OUTPUT_FILE = "structured_consultation_with_demographics.json"  # result
    PATIENT_ID = "0e1e1e51-53e8-46b8-b838-33c51a9e6dbd"                                    # patient id for lookup only

    try:
        # 1. Read JSON from file
        data = load_consultation_json(INPUT_FILE)

        # 2. Inject demographics
        updated = inject_demographics(data, PATIENT_ID)

        # 3. Save back to file
        save_consultation_json(updated, OUTPUT_FILE)

        # 4. Show result
        print("Injected successfully:")
        print("  age :", updated["extracted_data"]["age"])
        print("  sex :", updated["extracted_data"]["sex"])
        print(f"\nSaved to: {OUTPUT_FILE}")

    except FileNotFoundError:
        print(f"Input file not found: {INPUT_FILE}")
    except Exception as e:
        print("Injection failed:", e)