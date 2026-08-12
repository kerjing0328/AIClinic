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

2. If information is not mentioned, use:
   - "" for missing text
   - [] for missing lists
   - null for missing numeric vital signs

3. Do not diagnose the patient yourself.
   Only include a diagnosis if the doctor explicitly states it.

4. Preserve uncertainty.
   For example:
   "possible pneumonia" must remain a possible diagnosis and must
   not become a confirmed diagnosis.

5. Preserve clinically important negative findings.
   Examples:
   - "No fever" → relevant_negatives
   - "Denies chest pain" → relevant_negatives
   - "No known allergies" → allergies

6. Distinguish subjective and objective information:
   - Subjective = information reported by the patient
   - Objective = vital signs, examination findings, test results

7. For investigations:
   - Completed tests and their results → results
   - Tests ordered or recommended → ordered

8. Extract medications mentioned as:
   - Current medications
   - Newly prescribed medications
   - Other medication information explicitly discussed

9. Extract the consultation date only if explicitly mentioned.

10. Extract patient_id and doctor_id only if explicitly mentioned.

11. Consultation type:
   - "new" if clearly a new consultation
   - "follow-up" if clearly a follow-up consultation
   - "" if it cannot be determined

12. Do not copy the entire transcript.
   Summarize the extracted information concisely.

13. Return ONLY valid JSON.
   Do not return Markdown, explanations, or code fences.

Return exactly this JSON structure:

{
  "consultation": {
    "patient_id": "",
    "doctor_id": "",
    "date": "",
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
    },

    "clinical_note": {
      "subjective": "",
      "objective": "",
      "assessment": "",
      "plan": ""
    }
  }
}
"""

# 3. Create messages
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

# 5. Handle API errors
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