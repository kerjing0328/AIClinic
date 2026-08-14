import os
import json
from pathlib import Path

from dotenv import load_dotenv
from google import genai


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in .env")


client = genai.Client(api_key=GEMINI_API_KEY)


SYSTEM_PROMPT = """
You are a clinical information extraction assistant.

Your task is to extract structured clinical information from a transcript
of a conversation between a doctor and a patient.

IMPORTANT RULES:

1. Extract information ONLY from the transcript.
   Do not invent, assume, or fabricate information.

2. DISTINGUISH between "not mentioned" and "explicitly stated as none".
   This is critical:

   a) NOT MENTIONED AT ALL (topic never came up) → leave empty:
      - "" for text fields
      - [] for list fields
      - null for numeric vital signs

   b) EXPLICITLY STATED AS NONE / ABSENT → fill it with "NA":
      - Patient says "no allergies" → allergies: ["NA"]
      - Patient says "not taking any medication" → medications: ["NA"]
      - Patient says "no past medical history" → medical_history: ["NA"]
      - No tests were done and none mentioned → results: []
      - Doctor confirms "no tests needed" → ordered: ["NA"]
      - No social history discussed → social_history: ""
      - Patient says "I don't drink or smoke" →
        social_history: "No smoking, no alcohol"

   Rule of thumb:
   - Silence on a topic → empty ("" / [] / null)
   - Explicit "none / no / denies / not applicable" →
     ["NA"] or "NA"

3. Do not diagnose the patient yourself.
   Only include a diagnosis if the doctor explicitly states it.
   If no diagnosis is stated → diagnosis: [].

4. Preserve uncertainty.
   For example: "possible pneumonia" must remain a possible diagnosis
   and must not become a confirmed diagnosis.

5. Preserve clinically important negative findings as relevant_negatives.

6. For investigations:
   - Completed tests and their results → results
   - Tests ordered or recommended → ordered
   - If explicitly stated that no tests are needed → ordered: ["NA"]

7. Extract medications mentioned as:
   - Current medications
   - Newly prescribed medications
   - Other medication information explicitly discussed
   - If patient explicitly denies any medication → medications: ["NA"]

8. Consultation type:
   - "new" if clearly a new consultation
   - "follow-up" if clearly a follow-up consultation
   - "" if it cannot be determined

9. Do not copy the entire transcript.
   Summarize the extracted information concisely.

10. Return ONLY valid JSON.
    Do not return Markdown, explanations, or code fences.

Return exactly this JSON structure:

{
  "extracted_data": {
    "type": "",
    "chief_complaint": "",

    "history": {
      "symptoms": [],
      "onset": "",
      "duration": "",
      "severity": "",
      "associated_symptoms": [],
      "relevant_negatives": [],
      "medical_history": [],
      "medications": [],
      "allergies": [],
      "social_history": ""
    },

    "examination": {
      "vital_signs": {
        "temperature": null,
        "blood_pressure": "",
        "heart_rate": null,
        "respiratory_rate": null,
        "oxygen_saturation": null,
        "weight": null
      },
      "findings": ""
    },

    "investigations": {
      "results": [],
      "ordered": []
    },

    "assessment": {
      "diagnosis": [],
      "clinical_impression": ""
    },

    "plan": {
      "medications": [],
      "treatment": [],
      "referral": [],
      "follow_up": "",
      "safety_netting": [],
      "patient_instructions": []
    }
  }
}
"""


def extract_structured2(transcript_file: str) -> dict:
    """
    Read a consultation transcript file and extract structured
    clinical information using Google Gemini.

    Args:
        transcript_file: Name of the transcript file, e.g.
                         "transcript01.txt".

    Returns:
        Dictionary containing the extracted clinical data.
    """

    PROJECT_ROOT = Path(__file__).resolve().parents[3]

    transcript_path = (
        PROJECT_ROOT
        / "data"
        / "transcript_sample"
        / transcript_file
    )

    if not transcript_path.exists():
        raise FileNotFoundError(
            f"Transcript file not found: {transcript_path}"
        )

    # Read transcript
    with open(transcript_path, "r", encoding="utf-8") as file:
        transcript = file.read()

    if not transcript.strip():
        raise ValueError("Transcript cannot be empty.")

    print(f"Transcript loaded successfully: {transcript_file}")

    # Call Gemini
    interaction = client.interactions.create(
        model="gemini-3.5-flash",
        system_instruction=SYSTEM_PROMPT,
        input=(
            "Extract structured clinical data from the following "
            "doctor-patient consultation transcript:\n\n"
            + transcript
        ),
    )

    # Get response
    structured_data = interaction.output_text

    print("structured_data received from Gemini:")
    print(structured_data)

    # Parse JSON
    try:
        clinical_data = json.loads(structured_data)
    except json.JSONDecodeError as e:
        print("Model returned invalid JSON:")
        print(structured_data)
        raise e

    return clinical_data


if __name__ == "__main__":
    result = extract_structured2("transcript01.txt")
    print(json.dumps(result, indent=2, ensure_ascii=False))