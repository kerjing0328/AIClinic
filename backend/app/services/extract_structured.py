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

Your task is to extract concise, structured clinical information from a
transcript of a conversation between a doctor and a patient and organize it
into a structured SOAP clinical note. 

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

10. For SOAP Plan:
   - Extract only recommendations by the doctor.
   - Do not independently recommend medications, investigations, referrals, follow-up, or treatment.

11. Do not copy the entire transcript.
    Summarize the extracted information in brief and concisely. 

10. Return ONLY valid JSON.
    Do not return Markdown, explanations, or code fences.

Return exactly this JSON structure:

{
    "consultation_type": "new",
    "age": null,
    "gender": "",
    "chief_complaint": "",

    "SOAP": {
        "subjective": {
        "history": {
            "onset": "",
            "duration": "",
            "progression": "",
            "severity": "",
        },
        "symptoms": [],
        "relevant_negatives": [],
        "medical_history": [],
        "medications": [],
        "allergies": [],
        "social_history": ""
        }

        "objective": {
        "vital_signs": {
            "temperature": null,
            "blood_pressure": "",
            "heart_rate": null,
            "respiratory_rate": null,
            "oxygen_saturation": null,
            "weight": null
        },
        "examination": ""
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
    },

    "investigations": {
        "ordered": [],
        "results": []
    }
}
"""


def extract_structured(transcript_text: str) -> dict:
    """
    Extract structured clinical information from a consultation
    transcript using Google Gemini.

    Args:
        transcript_text: The raw transcript content (doctor/patient
                         lines).  Previously this accepted a filename;
                         it now expects the actual text.

    Returns:
        Dictionary containing the extracted clinical data.
    """

    if not transcript_text or not transcript_text.strip():
        raise ValueError("Transcript cannot be empty.")

    print("Transcript loaded successfully.")

    # Call Gemini
    interaction = client.interactions.create(
        model="gemini-3.5-flash-lite",
        system_instruction=SYSTEM_PROMPT,
        input=(
            "Extract structured clinical data from the following "
            "doctor-patient consultation transcript:\n\n"
            + transcript_text
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
    import sys

    # Legacy CLI: pass a filename to read from data/transcript_sample/
    name = sys.argv[1] if len(sys.argv) > 1 else "transcript01.txt"
    project_root = Path(__file__).resolve().parents[3]
    path = project_root / "data" / "transcript_sample" / name
    text = path.read_text(encoding="utf-8")
    result = extract_structured(text)
    print(json.dumps(result, indent=2, ensure_ascii=False))