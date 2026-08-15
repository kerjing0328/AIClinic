import type { Consultation } from "@/lib/api";

export type Stage = "select" | "transcript" | "extract" | "review" | "report";

/* ============================================================
   Diagnosis extraction
   ============================================================ */
export function extractDiagnosis(
  c: Consultation & { patient_name?: string; patient_ic?: string }
): string {
  const src =
    (c.extracted_data as Record<string, unknown>) ??
    (c.ai_extracted as Record<string, unknown>) ??
    {};
  const assessment = src?.assessment as Record<string, unknown> | undefined;
  const diagnosis = assessment?.diagnosis;
  if (Array.isArray(diagnosis)) return diagnosis.join(", ");
  if (typeof diagnosis === "string") return diagnosis;
  return "";
}

/* ============================================================
   Status display
   ============================================================ */
export function statusDisplay(status: string): {
  label: string;
  color: { bg: string; fg: string };
} {
  switch (status) {
    case "draft":
      return { label: "Draft", color: { bg: "#fef3c7", fg: "#92400e" } };
    case "transcribed":
      return { label: "Transcript Ready", color: { bg: "#dbeafe", fg: "#1e40af" } };
    case "extracting":
      return { label: "Extracting…", color: { bg: "#e0e7ff", fg: "#3730a3" } };
    case "ai_extracted":
      return { label: "Ready for Review", color: { bg: "#d1fae5", fg: "#065f46" } };
    case "doctor_approved":
    case "approved":
      return { label: "Approved", color: { bg: "#d1fae5", fg: "#065f46" } };
    default:
      return { label: status, color: { bg: "#f3f4f6", fg: "#374151" } };
  }
}

/* ============================================================
   Resume stage mapping
   ============================================================ */
export function resumeStageFromStatus(status: string): Stage {
  switch (status) {
    case "draft":
      return "transcript";
    case "transcribed":
      return "extract";
    case "ai_extracted":
    case "extracting":
      return "review";
    case "doctor_approved":
    case "approved":
      return "report";
    default:
      return "transcript";
  }
}

/* ============================================================
   JSON flatten / unflatten (for nested extracted_data forms)
   ============================================================ */
export function flatten(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      out[key] = v.join(", ");
    } else {
      out[key] = v == null ? "" : String(v);
    }
  }
  return out;
}

export function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let node = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) {
        node[p] = value;
      } else {
        node[p] = (node[p] as Record<string, unknown>) ?? {};
        node = node[p] as Record<string, unknown>;
      }
    });
  }
  return out;
}

/* ============================================================
   Form field helpers (for ReviewStage)
   ============================================================ */
export const MANDATORY_FIELDS = [
  "chief_complaint",
  "onset",
  "duration",
  "symptoms",
  "medical_history",
  "medications",
  "allergies",
  "vital_signs",
  "examination",
  "diagnosis",
  "clinical_impression",
];

const ORDER = [
  "chief_complaint",
  "type",
  "age",
  "gender",

  // SOAP
  "SOAP",

  // Subjective
  "subjective",
  "history",
  "onset",
  "duration",
  "progression",
  "severity",
  "symptoms",
  "relevant_negatives",
  "medical_history",
  "medications",
  "allergies",
  "social_history",

  // Objective
  "objective",
  "vital_signs",
  "temperature",
  "blood_pressure",
  "heart_rate",
  "respiratory_rate",
  "oxygen_saturation",
  "weight",
  "examination",

  // Assessment
  "assessment",
  "diagnosis",
  "clinical_impression",

  // Plan
  "plan",
  "medications",
  "treatment",
  "referral",
  "follow_up",
  "safety_netting",
  "patient_instructions",

  // Investigations
  "investigations",
  "ordered",
  "results",
];

export function lastSeg(key: string): string {
  const parts = key.split(".");
  return parts[parts.length - 1];
}

export function isMandatory(fullKey: string): boolean {
  const k = fullKey.toLowerCase();
  const leaf = lastSeg(fullKey).toLowerCase();
  return MANDATORY_FIELDS.some((m) => leaf.includes(m) || k.includes(m));
}

export function rank(seg: string): number {
  const i = ORDER.indexOf(seg.toLowerCase());
  return i === -1 ? ORDER.length + 1 : i;
}

export function prettyLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function prettyPath(key: string): string {
  return key
    .split(".")
    .map((seg) => prettyLabel(seg))
    .join(" › ");
}

/** Immediate children (leaves + subgroups) of a given prefix in the flat map. */
export function childrenOf(
  fields: Record<string, string>,
  prefix: string
): { leaves: string[]; subgroups: string[] } {
  const base = prefix ? prefix + "." : "";
  const leaves: string[] = [];
  const subgroups = new Set<string>();
  for (const key of Object.keys(fields)) {
    if (!key.startsWith(base)) continue;
    const rest = key.slice(base.length);
    if (!rest) continue;
    const dot = rest.indexOf(".");
    if (dot === -1) leaves.push(key);
    else subgroups.add(base + rest.slice(0, dot));
  }
  leaves.sort((a, b) => rank(lastSeg(a)) - rank(lastSeg(b)));
  const subs = [...subgroups].sort((a, b) => rank(lastSeg(a)) - rank(lastSeg(b)));
  return { leaves, subgroups: subs };
}

/** Count empty-mandatory leaves under a prefix (recursively). */
export function flagsUnder(
  fields: Record<string, string>,
  prefix: string
): number {
  const base = prefix ? prefix + "." : "";
  return Object.entries(fields).filter(
    ([key, value]) =>
      (prefix === "" || key.startsWith(base)) &&
      isMandatory(key) &&
      value.trim() === ""
  ).length;
}

/* ============================================================
   Fallback extracted data template
   ============================================================ */
export const SAMPLE_EXTRACTED: Record<string, unknown> = {
  chief_complaint: "",
  type: "",
  age: "",
  gender: "",
  history: {
    onset: "",
    duration: "",
    severity: "",
    symptoms: "",
    allergies: "",
    medications: "",
    medical_history: "",
  },
  examination: {
    findings: "",
    vital_signs: {
      blood_pressure: "",
      heart_rate: "",
      temperature: "",
      respiratory_rate: "",
      oxygen_saturation: "",
    },
  },
  assessment: {
    diagnosis: "",
    clinical_impression: "",
  },
  investigations: {
    ordered: "",
    results: "",
  },
  plan: {
    medications: "",
    treatment: "",
    follow_up: "",
    safety_netting: "",
  },
};
