import os
import json
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from google import genai

from app.services.document_search import DocumentSearch


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in .env")


client = genai.Client(api_key=GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """
You are a clinical consultation review assistant supporting a licensed doctor.

Your task is to review a structured doctor-patient consultation and identify:

1. RED FLAGS
   - Clinically concerning findings explicitly present in the consultation.
   - Findings that may require urgent assessment, escalation, investigation,
     treatment, or closer follow-up.
   - Only identify a red flag when it is supported by the consultation or
     reliable medical references provided to you.

2. MISSING / IMPORTANT INFORMATION
   - Important information that is absent from the consultation and would be
     useful for safe clinical decision-making.
   - Missing information must NOT be presented as if it were an abnormal
     finding.
   - Example: if oxygen saturation is not documented, say that oxygen
     saturation is not documented. Do NOT say that oxygen saturation is low.

3. DOCTOR SUGGESTIONS
   - Practical suggestions that may help the consulting doctor.
   - Suggestions may include further history, examination, investigations,
     medication review, safety-netting, follow-up, or referral.
   - Suggestions are advisory and must be based on the available consultation
     information and the supplied medical references.

4. POSITIVE FINDINGS / CLINICAL CONCERNS
   - Highlight clinically relevant findings even if they do not constitute an
     immediate red flag.

IMPORTANT SAFETY RULES:

1. Use ONLY information present in the consultation and the supplied medical
   references.

2. Do NOT invent symptoms, examination findings, vital signs, investigations,
   diagnoses, medications, or patient history.

3. Do NOT diagnose the patient.
   You may identify that an existing diagnosis or clinical impression may
   require reconsideration if the documented findings support that concern.

4. Do NOT assume that a missing value is normal or abnormal.

5. Clearly distinguish:
   - documented finding
   - possible concern
   - missing information
   - recommendation

6. Preserve uncertainty.
   If the consultation says "possible pneumonia", do not convert this into
   confirmed pneumonia.

7. Medication suggestions must be cautious.
   Do not recommend a specific medication or dose unless the consultation or
   supplied references clearly support the suggestion.

8. Red flags should be prioritized by severity:
   - "critical": potentially life-threatening / immediate escalation
   - "high": significant concern requiring prompt clinical review
   - "moderate": clinically important but not necessarily urgent
   - "low": minor concern or precaution

9. Do not overwhelm the doctor with generic advice.
   Suggestions should be specific to the consultation.

10. If there are no documented red flags, explicitly return an empty red_flags
    list. Do not manufacture one.

11. If there is insufficient information to determine whether a red flag is
    present, put the issue under missing_information rather than red_flags.

12. The final output must be valid JSON only.
    Do not return Markdown, explanations, or code fences.

Return exactly this structure:

{
  "review": {
    "overall_risk": "low",
    "requires_prompt_doctor_review": false,

    "red_flags": [
      {
        "severity": "critical",
        "finding": "",
        "reason": "",
        "recommended_action": ""
      }
    ],

    "clinical_concerns": [
      {
        "finding": "",
        "reason": "",
        "recommended_action": ""
      }
    ],

    "missing_information": [
      {
        "information": "",
        "why_it_matters": ""
      }
    ],

    "doctor_suggestions": [
      {
        "category": "",
        "suggestion": "",
        "reason": ""
      }
    ],

    "safety_netting_suggestions": [],

    "summary": ""
  },

  "references": [
    {
      "content": "",
      "similarity": null
    }
  ]
}
"""


# ---------------------------------------------------------------------------
# CONSULTATION REVIEW SERVICE
# ---------------------------------------------------------------------------

class ConsultationReview:
    """
    Reviews a structured consultation using:
      1. Semantic retrieval from medical references
      2. Gemini clinical review

    This service does not diagnose the patient. It provides a second-pass
    safety review for the consulting doctor.
    """

    def __init__(
        self,
        embedding_model_id: str = "BAAI/bge-small-en-v1.5",
        gemini_model: str = "gemini-3.5-flash",
    ):
        self.document_search = DocumentSearch(
            embedding_model_id=embedding_model_id
        )

        self.gemini_model = gemini_model

    # -----------------------------------------------------------------------
    # Build search query
    # -----------------------------------------------------------------------

    def _build_search_query(self, consultation: dict) -> str:
        """
        Convert the structured consultation JSON into a concise semantic
        search query for the medical-reference database.
        """

        extracted = consultation.get("extracted_data", consultation)

        history = extracted.get("history", {})
        examination = extracted.get("examination", {})
        assessment = extracted.get("assessment", {})
        investigations = extracted.get("investigations", {})
        plan = extracted.get("plan", {})

        parts = []

        chief_complaint = extracted.get("chief_complaint")
        if chief_complaint:
            parts.append(f"Chief complaint: {chief_complaint}")

        symptoms = history.get("symptoms", [])
        if symptoms:
            parts.append(
                "Symptoms: " + ", ".join(map(str, symptoms))
            )

        associated_symptoms = history.get("associated_symptoms", [])
        if associated_symptoms:
            parts.append(
                "Associated symptoms: "
                + ", ".join(map(str, associated_symptoms))
            )

        relevant_negatives = history.get("relevant_negatives", [])
        if relevant_negatives:
            parts.append(
                "Relevant negatives: "
                + ", ".join(map(str, relevant_negatives))
            )

        medical_history = history.get("medical_history", [])
        if medical_history:
            parts.append(
                "Medical history: "
                + ", ".join(map(str, medical_history))
            )

        medications = history.get("medications", [])
        if medications:
            parts.append(
                "Medications: "
                + ", ".join(map(str, medications))
            )

        allergies = history.get("allergies", [])
        if allergies:
            parts.append(
                "Allergies: "
                + ", ".join(map(str, allergies))
            )

        findings = examination.get("findings")
        if findings:
            parts.append(f"Examination: {findings}")

        vital_signs = examination.get("vital_signs", {})
        documented_vitals = []

        for key, value in vital_signs.items():
            if value is not None and value != "":
                documented_vitals.append(f"{key}: {value}")

        if documented_vitals:
            parts.append(
                "Vital signs: " + ", ".join(documented_vitals)
            )

        diagnosis = assessment.get("diagnosis", [])
        if diagnosis:
            parts.append(
                "Documented diagnosis: "
                + ", ".join(map(str, diagnosis))
            )

        clinical_impression = assessment.get("clinical_impression")
        if clinical_impression:
            parts.append(
                f"Clinical impression: {clinical_impression}"
            )

        investigation_results = investigations.get("results", [])
        if investigation_results:
            parts.append(
                "Investigation results: "
                + ", ".join(map(str, investigation_results))
            )

        ordered = investigations.get("ordered", [])
        if ordered:
            parts.append(
                "Investigations ordered: "
                + ", ".join(map(str, ordered))
            )

        treatment = plan.get("treatment", [])
        if treatment:
            parts.append(
                "Treatment: " + ", ".join(map(str, treatment))
            )

        plan_medications = plan.get("medications", [])
        if plan_medications:
            parts.append(
                "Plan medications: "
                + ", ".join(map(str, plan_medications))
            )

        return "\n".join(parts)

    # -----------------------------------------------------------------------
    # Retrieve medical references
    # -----------------------------------------------------------------------

    def _retrieve_references(
        self,
        consultation: dict,
        match_threshold: float = 0.5,
        match_count: int = 5,
    ) -> list[dict]:
        """
        Retrieve medically relevant reference chunks using semantic search.
        """

        query = self._build_search_query(consultation)

        if not query.strip():
            return []

        try:
            references = self.document_search.search(
                query=query,
                match_threshold=match_threshold,
                match_count=match_count,
            )

            return references or []

        except Exception as exc:
            # Retrieval failure should not prevent the consultation review.
            print(f"Medical reference search failed: {exc}")
            return []

    # -----------------------------------------------------------------------
    # Format references for Gemini
    # -----------------------------------------------------------------------

    def _format_references(self, references: list[dict]) -> str:
        """
        Convert database search results into text that can be supplied to
        Gemini.
        """

        if not references:
            return "No medical references were retrieved."

        formatted = []

        for index, reference in enumerate(references, start=1):
            # Try common column names used by vector-search functions.
            content = (
                reference.get("content")
                or reference.get("text")
                or reference.get("document")
                or reference.get("chunk")
                or ""
            )

            similarity = (
                reference.get("similarity")
                if reference.get("similarity") is not None
                else reference.get("match_score")
            )

            formatted.append(
                f"REFERENCE {index}\n"
                f"Similarity: {similarity}\n"
                f"Content:\n{content}"
            )

        return "\n\n".join(formatted)

    # -----------------------------------------------------------------------
    # LLM review
    # -----------------------------------------------------------------------

    def _review_with_llm(
        self,
        consultation: dict,
        references: list[dict],
    ) -> dict:
        """
        Send consultation + retrieved references to Gemini.
        """

        consultation_json = json.dumps(
            consultation,
            indent=2,
            ensure_ascii=False,
        )

        references_text = self._format_references(references)

        prompt = f"""
Review the following structured clinical consultation.

====================
CONSULTATION
====================

{consultation_json}


====================
RETRIEVED MEDICAL REFERENCES
====================

{references_text}


====================
TASK
====================

Identify:

1. Any documented red flags.
2. Other clinically important concerns.
3. Important information that is missing.
4. Practical suggestions for the consulting doctor.
5. Safety-netting suggestions where appropriate.

Base your review on the consultation and the retrieved medical references.

Do not invent information.

Remember:
- Missing information is not a red flag.
- Do not diagnose the patient.
- Do not assume undocumented findings are normal.
- Do not turn a possibility into a confirmed diagnosis.
- Prioritize patient safety.
- Be concise and clinically useful.
"""

        interaction = client.interactions.create(
            model=self.gemini_model,
            system_instruction=SYSTEM_PROMPT,
            input=prompt,
        )

        output_text = interaction.output_text

        if not output_text:
            raise ValueError("Gemini returned an empty response.")

        try:
            return json.loads(output_text)

        except json.JSONDecodeError as exc:
            print("Gemini returned invalid JSON:")
            print(output_text)
            raise ValueError(
                "Gemini consultation review returned invalid JSON."
            ) from exc

    # -----------------------------------------------------------------------
    # Public review method
    # -----------------------------------------------------------------------

    def review(
        self,
        consultation: dict,
        match_threshold: float = 0.5,
        match_count: int = 5,
    ) -> dict:
        """
        Review a structured consultation.

        Args:
            consultation:
                Structured consultation JSON.

            match_threshold:
                Minimum semantic similarity for medical references.

            match_count:
                Maximum number of medical references to retrieve.

        Returns:
            Review JSON containing:
                - red flags
                - clinical concerns
                - missing information
                - doctor suggestions
                - safety-netting suggestions
                - summary
                - retrieved references
        """

        if not isinstance(consultation, dict):
            raise TypeError("consultation must be a dictionary.")

        # Retrieve relevant medical knowledge.
        references = self._retrieve_references(
            consultation=consultation,
            match_threshold=match_threshold,
            match_count=match_count,
        )

        # Ask Gemini to perform the clinical review.
        review_result = self._review_with_llm(
            consultation=consultation,
            references=references,
        )

        # Keep the original retrieval information visible to the caller.
        review_result.setdefault("references", [])

        if not review_result["references"]:
            for reference in references:
                content = (
                    reference.get("content")
                    or reference.get("text")
                    or reference.get("document")
                    or reference.get("chunk")
                    or ""
                )

                similarity = (
                    reference.get("similarity")
                    if reference.get("similarity") is not None
                    else reference.get("match_score")
                )

                review_result["references"].append(
                    {
                        "content": content,
                        "similarity": similarity,
                    }
                )

        return review_result


# ---------------------------------------------------------------------------
# REVIEW ENTRY POINT - accept extracted_data in json as consultation for review
# ---------------------------------------------------------------------------

def review_consultation(
    consultation: dict,
    match_threshold: float = 0.5,
    match_count: int = 5,
) -> dict:
    """
    Review a structured consultation dict directly.

    This is the primary entry point used by the API layer. It accepts the
    consultation data in memory (no file dependency).

    Args:
        consultation:
            Structured consultation data, e.g. {"extracted_data": {...}}.

        match_threshold:
            Minimum semantic similarity for medical references.

        match_count:
            Maximum number of medical references to retrieve.

    Returns:
        Review JSON (red flags, concerns, suggestions, references, ...).
    """

    if not isinstance(consultation, dict):
        raise TypeError("consultation must be a dictionary.")

    reviewer = ConsultationReview()

    return reviewer.review(
        consultation=consultation,
        match_threshold=match_threshold,
        match_count=match_count,
    )


# ---------------------------------------------------------------------------
# FILE HELPERS  (kept for CLI / offline testing)
# ---------------------------------------------------------------------------

def load_consultation_json(file_path: str) -> dict:
    """
    Load a structured consultation JSON file.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Consultation file not found: {file_path}"
        )

    with open(path, "r", encoding="utf-8") as file:
        consultation = json.load(file)

    if not isinstance(consultation, dict):
        raise ValueError(
            "Consultation JSON must contain a JSON object."
        )

    return consultation


def review_consultation_file(
    consultation_file: str,
    match_threshold: float = 0.5,
    match_count: int = 5,
) -> dict:
    """
    Load a consultation JSON file and review it.
    """

    consultation = load_consultation_json(consultation_file)

    return review_consultation(
        consultation=consultation,
        match_threshold=match_threshold,
        match_count=match_count,
    )


# ---------------------------------------------------------------------------
# CLI / TEST
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Review a structured clinical consultation."
    )

    parser.add_argument(
        "consultation_file",
        help="Path to consultation JSON file.",
    )

    parser.add_argument(
        "--threshold",
        type=float,
        default=0.5,
        help="Medical reference similarity threshold.",
    )

    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of medical references to retrieve.",
    )

    args = parser.parse_args()

    result = review_consultation_file(
        consultation_file=args.consultation_file,
        match_threshold=args.threshold,
        match_count=args.count,
    )

    print(
        json.dumps(
            result,
            indent=2,
            ensure_ascii=False,
        )
    )