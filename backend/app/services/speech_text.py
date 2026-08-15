"""
speech_text.py
--------------
Audio → text transcription using Google Gemini.

Provides:
  - transcribe_audio_stream(audio_path) → generator yielding complete lines
  - CLI mode when run directly (legacy behaviour)
"""

import os
import time
from pathlib import Path
from typing import Generator

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-3.5-flash"

TRANSCRIPTION_PROMPT = """
You are a medical conversation transcription system.

Your task is to transcribe the conversation and identify
the two speakers:

1. doctor
2. patient

IMPORTANT:

- Carefully listen to the entire audio before producing the
  final transcription.
- Determine which speaker is the doctor and which speaker is
  the patient based on the content and context of the dialogue.
- The doctor typically asks medical questions, explains
  diagnoses, discusses symptoms, treatments, medications,
  examinations, or medical advice.
- The patient typically describes symptoms, medical history,
  pain, concerns, medications, or personal experiences.
- Do NOT assume that the first speaker is the doctor.
- Do NOT assume that the second speaker is the patient.
- Use the conversational context to determine their roles.
- Keep the wording as close to the spoken audio as possible.
- Do not summarize.
- Do not rewrite the conversation.
- Do not add information that was not spoken.
- Preserve the original language.
- Correct obvious transcription mistakes when the intended
  spoken words are clear.
- Include punctuation.

OUTPUT FORMAT:

doctor: <spoken text>
patient: <spoken text>
doctor: <spoken text>
patient: <spoken text>

Every speaker turn MUST start with either:
doctor:
or
patient:

Do NOT use:
Doctor:
Patient:
Speaker 1:
Speaker 2:

Do NOT include timestamps.

Do NOT include explanations.

Do NOT include a summary.

Return ONLY the speaker-labeled transcription.
"""


def _get_client() -> genai.Client:
    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set.")
    return genai.Client(api_key=API_KEY)


def _upload_and_wait(client: genai.Client, audio_path: str) -> types.File:
    """Upload an audio file to Gemini and poll until processing is complete."""
    audio_file = client.files.upload(file=audio_path)

    while True:
        uploaded = client.files.get(name=audio_file.name)
        state = uploaded.state.name
        if state == "ACTIVE":
            return uploaded
        if state == "FAILED":
            raise RuntimeError("Gemini failed to process the audio.")
        time.sleep(2)


def transcribe_audio_stream(
    audio_path: str,
) -> Generator[str, None, None]:
    """
    Upload *audio_path* to Gemini and yield complete transcription lines.

    Each yielded string is a single line such as ``"doctor: ..."`` or
    ``"patient: ..."``.  Lines are yielded as soon as they are fully
    received from the streaming response.
    """
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    client = _get_client()

    print(f"[speech_text] Uploading {path.name} …")
    uploaded = _upload_and_wait(client, str(path))
    print(f"[speech_text] Uploaded: {uploaded.name}  – transcribing …")

    response_stream = client.models.generate_content_stream(
        model=MODEL_NAME,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_uri(
                        file_uri=uploaded.uri,
                        mime_type=uploaded.mime_type,
                    ),
                    types.Part.from_text(text=TRANSCRIPTION_PROMPT),
                ],
            )
        ],
    )

    buffer = ""
    for chunk in response_stream:
        if not chunk.text:
            continue
        buffer += chunk.text

        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()
            if line:
                yield line

    remaining = buffer.strip()
    if remaining:
        yield remaining


# ------------------------------------------------------------------
# CLI entry-point (legacy)
# ------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    AUDIO_FILE = (
        sys.argv[1]
        if len(sys.argv) > 1
        else r"C:\Users\jing2\OneDrive\Desktop\AIClinic\data\conversation.mp3"
    )
    OUTPUT_FILE = "transcription.txt"

    print(f"Audio file: {AUDIO_FILE}")
    print("=" * 70)
    print("LIVE TRANSCRIPTION")
    print("=" * 70)

    full: list[str] = []
    for line in transcribe_audio_stream(AUDIO_FILE):
        print(line, flush=True)
        full.append(line)

    transcription = "\n".join(full)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(transcription)

    print("=" * 70)
    print(f"\nSaved to: {OUTPUT_FILE}")
