// lib/transcript.ts
// Parses a raw consultation transcript into chat turns.
// Recognises lines like "Doctor: ...", "Dr: ...", "Patient: ...", "P: ..."
// Lines without a speaker prefix are appended to the previous turn.

export interface Turn {
  speaker: "doctor" | "patient" | "other";
  name: string;
  text: string;
}

const DOCTOR_RE = /^\s*(doctor|dr\.?|physician|clinician)\s*[:\-]\s*/i;
const PATIENT_RE = /^\s*(patient|pt\.?|p)\s*[:\-]\s*/i;
const GENERIC_RE = /^\s*([A-Za-z .]{1,30})\s*[:\-]\s+/;

export function parseTranscript(raw: string): Turn[] {
  const lines = raw.split(/\r?\n/);
  const turns: Turn[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    if (DOCTOR_RE.test(line)) {
      turns.push({
        speaker: "doctor",
        name: "Doctor",
        text: line.replace(DOCTOR_RE, "").trim(),
      });
    } else if (PATIENT_RE.test(line)) {
      turns.push({
        speaker: "patient",
        name: "Patient",
        text: line.replace(PATIENT_RE, "").trim(),
      });
    } else {
      const m = line.match(GENERIC_RE);
      if (m) {
        turns.push({
          speaker: "other",
          name: m[1].trim(),
          text: line.replace(GENERIC_RE, "").trim(),
        });
      } else if (turns.length) {
        // continuation of the previous speaker
        turns[turns.length - 1].text += " " + line.trim();
      } else {
        turns.push({ speaker: "other", name: "Note", text: line.trim() });
      }
    }
  }

  return turns;
}
