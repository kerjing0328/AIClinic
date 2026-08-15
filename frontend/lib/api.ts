// lib/api.ts
// API client for the FastAPI backend.
// Set NEXT_PUBLIC_API_URL in .env.local (defaults to local dev server).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ============================================================
   Types
   ============================================================ */
export interface Patient {
  id?: string | number;
  patient_id?: string | number;
  patient_ic: string;
  name: string;
  phone: string;
  address: string;
  age?: number;
  gender?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Doctor {
  id?: string | number;
  doctor_id?: string | number;
  name: string;
  email: string;
  specialization?: string;
  [key: string]: unknown;
}

export type ConsultationStatus =
  | "draft"
  | "transcribed"
  | "ai_extracted"
  | "doctor_approved";

export interface Consultation {
  id?: string | number;
  consultation_id?: string | number;
  patient_id: string | number;
  doctor_id?: string | number;
  status?: ConsultationStatus | string;
  transcript_path?: string;
  extracted_data?: Record<string, unknown>;
  consultation_date?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CreatePatientRequest {
  patient_ic: string;
  name: string;
  phone: string;
  address: string;
}
export type UpdatePatientRequest = Partial<CreatePatientRequest>;

/* ---- AI review types (POST /consultations/{id}/ai-review) ---- */
export interface AiReviewItem {
  severity?: string;
  finding?: string;
  reason?: string;
  recommended_action?: string;
  information?: string;
  why_it_matters?: string;
  category?: string;
  suggestion?: string;
}

export interface AiReviewContent {
  overall_risk?: string;
  requires_prompt_doctor_review?: boolean;
  red_flags?: AiReviewItem[];
  clinical_concerns?: AiReviewItem[];
  missing_information?: AiReviewItem[];
  doctor_suggestions?: AiReviewItem[];
  safety_netting_suggestions?: (string | AiReviewItem)[];
  summary?: string;
}

export interface AiReviewReference {
  text?: string;
  similarity?: number | null;
  source?: string;
  pages?: string;
}

export interface MedicalReferenceDocument {
  name: string;
  size_bytes: number;
  modified_at: number;
}

export interface AiReviewPayload {
  review?: AiReviewContent;
  references?: AiReviewReference[];
}

/* ============================================================
   Core fetch helper
   ============================================================ */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new Error(
      "Unable to reach the server. Please check your connection and try again."
    );
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* no JSON body */
  }

  if (!res.ok) {
    const detail =
      (payload as { detail?: string } | null)?.detail ??
      `Request failed (${res.status}). Please try again.`;
    throw new Error(detail);
  }
  return payload as T;
}

/* Read a record's id regardless of field name. */
export function patientKey(p: Patient): string | number {
  return (p.patient_id ?? p.id ?? p.patient_ic) as string | number;
}
export function doctorKey(d: Doctor): string | number {
  return (d.doctor_id ?? d.id ?? d.email) as string | number;
}
export function consultationKey(c: Consultation): string | number {
  return (c.consultation_id ?? c.id) as string | number;
}

/* ============================================================
   Patients
   ============================================================ */
export function createPatient(data: CreatePatientRequest) {
  return request<{ success: boolean; message: string; patient: Patient }>(
    "/patients",
    { method: "POST", body: JSON.stringify(data) }
  );
}
export function getPatients() {
  return request<{ success: boolean; patients: Patient[] }>("/patients");
}
export function getPatient(id: string | number) {
  return request<{ success: boolean; patient: Patient }>(
    `/patients/${encodeURIComponent(String(id))}`
  );
}
export function updatePatient(id: string | number, data: UpdatePatientRequest) {
  return request<{ success: boolean; message: string; patient: Patient }>(
    `/patients/${encodeURIComponent(String(id))}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}
export function deletePatient(id: string | number) {
  return request<{ success: boolean; message: string }>(
    `/patients/${encodeURIComponent(String(id))}`,
    { method: "DELETE" }
  );
}
export function getConsultationsByPatient(id: string | number) {
  return request<{ success: boolean; consultations: Consultation[] }>(
    `/patients/${encodeURIComponent(String(id))}/consultations`
  );
}

/* ============================================================
   Doctors  (auth + lookup)
   ============================================================ */

/** POST /doctors/signin — sign in by email, returns the doctor record. */
export function signinDoctor(email: string) {
  return request<{ success: boolean; doctor: Doctor }>("/doctors/signin", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
export function getDoctors(limit?: number) {
  const q = limit ? `?limit=${limit}` : "";
  return request<{ success: boolean; count: number; doctors: Doctor[] }>(
    `/doctors${q}`
  );
}
export function getDoctor(id: string | number) {
  return request<{ success: boolean; doctor: Doctor }>(
    `/doctors/${encodeURIComponent(String(id))}`
  );
}
export function getConsultationsByDoctor(id: string | number) {
  return request<{
    success: boolean;
    consultations: (Consultation & { patient_name?: string; patient_ic?: string })[];
  }>(`/doctors/${encodeURIComponent(String(id))}/consultations`);
}

/* ============================================================
   Consultation pipeline
   ============================================================ */

/** STAGE 1 — POST /consultations → status: draft */
export function createConsultation(patient_id: string, doctor_id: string) {
  return request<{
    success: boolean;
    message: string;
    status: string;
    consultation: Consultation;
  }>("/consultations", {
    method: "POST",
    body: JSON.stringify({ patient_id, doctor_id }),
  });
}

/** GET /consultations/{id} — fetch a consultation (incl. extracted_data json). */
export function getConsultation(id: string | number) {
  return request<{ success: boolean; consultation: Consultation }>(
    `/consultations/${encodeURIComponent(String(id))}`
  );
}

/** STAGE 2 — PATCH /consultations/{id}/transcribed → status: transcribed */
export function setTranscribed(id: string | number, transcript_path: string, transcript_content: string = "") {
  return request<{
    success: boolean;
    message: string;
    status: string;
    consultation: Consultation;
  }>(`/consultations/${encodeURIComponent(String(id))}/transcribed`, {
    method: "PATCH",
    body: JSON.stringify({ transcript_path, transcript_content }),
  });
}

/** STAGE 3 (trigger) — PATCH /consultations/{id}/ai-extracted */
export function setAiExtracted(id: string | number) {
  return request<{
    success: boolean;
    message: string;
    status: string;
    consultation: Consultation;
  }>(`/consultations/${encodeURIComponent(String(id))}/ai-extracted`, {
    method: "PATCH",
  });
}

/** PATCH /consultations/{id}/extracted-data — save edited extracted data without changing status. */
export function saveExtractedData(id: string | number, extracted_data: Record<string, unknown>) {
  return request<{
    success: boolean;
    message: string;
    status: string;
    consultation: Consultation;
  }>(`/consultations/${encodeURIComponent(String(id))}/extracted-data`, {
    method: "PATCH",
    body: JSON.stringify({ extracted_json: extracted_data }),
  });
}

/** STAGE 3 (read) — GET /consultations/{id}/ai-extracted (no re-trigger) */
export function getAiExtracted(id: string | number) {
  return request<{
    success: boolean;
    status: string;
    extracted_data: Record<string, unknown> | null;
  }>(`/consultations/${encodeURIComponent(String(id))}/ai-extracted`);
}

/** STAGE 4 — POST /consultations/{id}/ai-review — generate and store an AI clinical review. */
export function generateAiReview(id: string | number) {
  return request<{
    success: boolean;
    message: string;
    status: string;
    review: AiReviewPayload | null;
  }>(`/consultations/${encodeURIComponent(String(id))}/ai-review`, {
    method: "POST",
  });
}

/** GET /consultations/{id}/ai-review — fetch a stored AI review (read-only). */
export function getAiReview(id: string | number) {
  return request<{
    success: boolean;
    status: string;
    review: AiReviewPayload | null;
  }>(`/consultations/${encodeURIComponent(String(id))}/ai-review`);
}

/** STAGE 5 — PATCH /consultations/{id}/doctor-approved → status: doctor_approved */
export function setDoctorApproved(
  id: string | number,
  extracted_data: Record<string, unknown>
) {
  return request<{
    success: boolean;
    message: string;
    status: string;
    consultation: Consultation;
  }>(`/consultations/${encodeURIComponent(String(id))}/doctor-approved`, {
    method: "PATCH",
    body: JSON.stringify({ extracted_data }),
  });
}

/** DELETE /consultations/{id} — delete a consultation. */
export function deleteConsultation(id: string | number) {
  return request<{ success: boolean; message: string }>(
    `/consultations/${encodeURIComponent(String(id))}`,
    { method: "DELETE" }
  );
}

/** Direct URL to the server-generated PDF report (open or download). */
export function consultationReportUrl(id: string | number): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${base}/consultations/${encodeURIComponent(String(id))}/report`;
}

/* ============================================================
   Medical References
   ============================================================ */

/** GET /medical-references — list all PDF files in data/medical_references/. */
export function getMedicalReferences() {
  return request<{
    success: boolean;
    documents: MedicalReferenceDocument[];
  }>("/medical_references");
}

/** Direct URL to view a medical reference PDF in the browser. */
export function medicalReferencePdfUrl(filename: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${base}/medical_references/${encodeURIComponent(filename)}`;
}

/** Fetch the report as a Blob and trigger a browser download (keeps auth headers if you add them later). */
export async function downloadConsultationReport(id: string | number): Promise<void> {
  const url = consultationReportUrl(id);
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `Failed to generate report (${res.status}).`;
    try {
      const j = await res.json();
      detail = j?.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `consultation_${id}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

