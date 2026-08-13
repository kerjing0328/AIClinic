import requests
import os
from dotenv import load_dotenv
import json
from pathlib import Path

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY is not set in .env")

# Read transcript file
PROJECT_ROOT = Path(__file__).resolve().parents[3]
transcript_path = (
    PROJECT_ROOT
    / "data"
    / "transcript_sample"
    / "transcript01.txt"
)
with open(transcript_path, "r", encoding="utf-8") as file:
    transcript = file.read()
print("Transcript loaded successfully.")

# Clinical extraction prompt
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

   b) EXPLICITLY STATED AS NONE / ABSENT (patient or doctor actively
      confirmed there is nothing) → DO NOT leave empty. Fill it with "NA":
      - Patient says "no allergies" → allergies: ["NA"]
      - Patient says "not taking any medication" → medications: ["NA"]
      - Patient says "no past medical history" → medical_history: ["NA"]
      - No tests were done and none mentioned → results: [] (not mentioned)
      - Doctor confirms "no tests needed" → ordered: ["NA"]
      - No social history discussed → social_history: "" (not mentioned)
      - Patient says "I don't drink or smoke" → social_history: "No smoking, no alcohol"

   Rule of thumb:
   - Silence on a topic → empty ("" / [] / null)
   - An explicit "none / no / denies / not applicable" → ["NA"] or "NA"

3. Do not diagnose the patient yourself.
   Only include a diagnosis if the doctor explicitly states it.
   If no diagnosis is stated → diagnosis: [] (not [""]).

4. Preserve uncertainty.
   For example: "possible pneumonia" must remain a possible diagnosis and
   must not become a confirmed diagnosis.

5. Preserve clinically important negative findings as relevant_negatives.
   Examples:
   - "No fever" → relevant_negatives: ["no fever"]
   - "Denies chest pain" → relevant_negatives: ["denies chest pain"]
   - "No shortness of breath" → relevant_negatives: ["no shortness of breath"]
   (Note: allergy/medication/history denials go in their own fields as "NA",
    NOT in relevant_negatives.)

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

# Create messages
messages = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT
    },
    {
        "role": "user",
        "content": (
            "Extract structured clinical data from the following "
            "doctor-patient consultation transcript:\n\n"
            + transcript
        )
    }
]

# Call OpenRouter
response = requests.post(
    url="https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "model": "openai/gpt-oss-20b:free",
        "messages": messages,
        "reasoning": {
            "enabled": True
        }
    }
)

# Handle API errors
if not response.ok:
    print("OpenRouter error:")
    print(response.text)
    response.raise_for_status()

data = response.json()
structured_data = data["choices"][0]["message"]["content"]

clinical_data = json.loads(structured_data)

output_path = "structured_consultation.json"

with open(output_path, "w", encoding="utf-8") as file:
    json.dump(clinical_data, file, indent=2, ensure_ascii=False)

print(f"Structured data saved to: {output_path}")