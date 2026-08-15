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
    case "ai_reviewed":
      return { label: "Ready for Review", color: { bg: "#d1fae5", fg: "#065f46" } };
    case "doctor_approved":
    case "approved":
      return { label: "Approved", color: { bg: "#d1fae5", fg: "#065f46" } };
    default:
      return { label: status, color: { bg: "#f3f4f6", fg: "#374151" } };
  }
}

/* ============================================================
   Status classification helpers
   ============================================================ */
const INCOMPLETE_STATUSES = ["draft", "transcribed", "extracting", "ai_extracted"];
const COMPLETE_STATUSES = ["ai_reviewed", "doctor_approved", "approved"];

export function isIncomplete(status: string): boolean {
  return INCOMPLETE_STATUSES.includes(status);
}

export function isComplete(status: string): boolean {
  return COMPLETE_STATUSES.includes(status);
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
    case "ai_reviewed":
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

/* ============================================================
   SOAP-ordered grouping for ReviewStage
   ============================================================ */

const SOAP_FIELD_ORDER: Record<string, string[]> = {
  subjective: [
    "history", "onset", "duration", "progression", "severity",
    "symptoms", "relevant_negatives", "medical_history",
    "medications", "allergies", "social_history",
  ],
  objective: ["vital_signs", "examination", "findings"],
  assessment: ["diagnosis", "clinical_impression"],
  plan: [
    "medications", "treatment", "referral",
    "follow_up", "safety_netting", "patient_instructions",
  ],
};

function orderedKeys(obj: Record<string, unknown>, order: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const k of order) {
    if (k in obj) {
      result.push(k);
      seen.add(k);
    }
  }
  for (const k of Object.keys(obj)) {
    if (!seen.has(k)) result.push(k);
  }
  return result;
}

export interface SoapGroup {
  heading: string;
  fields: { key: string; flatKey: string; value: string }[];
}

/**
 * Convert raw extracted_data into SOAP-ordered groups for rendering.
 * Each group has a heading and a flat list of key-value fields.
 * Nested dicts (like vital_signs) are flattened into the parent group
 * without creating separate sub-group headers.
 */
export function soapGroups(data: Record<string, unknown>): SoapGroup[] {
  const groups: SoapGroup[] = [];
  const hasSoap = data.SOAP && typeof data.SOAP === "object";

  // 1. Details — top-level scalars (chief_complaint, type, age, gender, etc.)
  // flatten() produces keys like "type", "age" — no SOAP prefix for these
  const topLevel: { key: string; flatKey: string; value: string }[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === "SOAP" || k === "investigations" || (typeof v === "object" && v !== null)) continue;
    topLevel.push({ key: k, flatKey: k, value: _str(v) });
  }
  if (topLevel.length) {
    groups.push({ heading: "Details", fields: topLevel });
  }

  // 2. SOAP sections in order
  // flatten() produces "SOAP.subjective.symptoms" — section keys need "SOAP." prefix
  const soap = (hasSoap ? data.SOAP : data) as Record<string, unknown>;
  const sectionPrefix = hasSoap ? "SOAP." : "";
  for (const section of ["subjective", "objective", "assessment", "plan"]) {
    const sectionData = (soap[section] ?? {}) as Record<string, unknown>;
    if (!sectionData || Object.keys(sectionData).length === 0) continue;

    const order = SOAP_FIELD_ORDER[section] ?? [];
    const fields: { key: string; flatKey: string; value: string }[] = [];

    for (const k of orderedKeys(sectionData, order)) {
      const v = sectionData[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // Flatten nested dict (e.g. vital_signs) — no sub-heading
        for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
          fields.push({ key: sk, flatKey: `${sectionPrefix}${section}.${k}.${sk}`, value: _str(sv) });
        }
      } else {
        fields.push({ key: k, flatKey: `${sectionPrefix}${section}.${k}`, value: _str(v) });
      }
    }

    if (fields.length) {
      groups.push({
        heading: section.charAt(0).toUpperCase() + section.slice(1),
        fields,
      });
    }
  }

  // 3. Investigations
  const inv = (data.investigations ?? {}) as Record<string, unknown>;
  if (inv && Object.keys(inv).length > 0) {
    const fields: { key: string; flatKey: string; value: string }[] = [];
    for (const k of orderedKeys(inv, ["ordered", "results"])) {
      fields.push({ key: k, flatKey: `${sectionPrefix}investigations.${k}`, value: _str(inv[k]) });
    }
    if (fields.length) {
      groups.push({ heading: "Investigations", fields });
    }
  }

  return groups;
}

function _str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v).trim();
}
