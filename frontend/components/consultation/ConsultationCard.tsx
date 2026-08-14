"use client";

import { consultationKey, type Consultation } from "@/lib/api";
import { extractDiagnosis, statusDisplay } from "@/lib/consultation-utils";

type ConsultationWithPatient = Consultation & {
  patient_name?: string;
  patient_ic?: string;
};

interface ConsultationCardProps {
  consultation: ConsultationWithPatient;
  onResume: (c: Consultation) => void;
  onDelete: (c: Consultation) => void;
}

export default function ConsultationCard({ consultation, onResume, onDelete }: ConsultationCardProps) {
  const status = (consultation.status as string) || "draft";
  const { label: statusLabel, color } = statusDisplay(status);
  const isIncomplete = ["draft", "transcribed", "extracting", "ai_extracted"].includes(status);
  const isApproved = ["doctor_approved", "approved"].includes(status);

  const dateStr = consultation.consultation_date
    ? new Date(consultation.consultation_date).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : consultation.created_at
    ? new Date(consultation.created_at).toLocaleDateString("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const diagnosis = extractDiagnosis(consultation);
  const hasDiagnosis = diagnosis.trim() !== "";

  return (
    <div
      className="glass flex flex-col gap-4 rounded-3xl p-6 transition hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
      style={{ borderRadius: "var(--radius-panel)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-main)] truncate">
            {consultation.patient_name || "Unknown Patient"}
          </h3>
          <span
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: color.bg, color: color.fg }}
          >
            {statusLabel}
          </span>
          {String(consultation.consultation_type ?? "") !== "" && (
            <span className="shrink-0 rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
              {String(consultation.consultation_type) === "new" ? "New" : "Follow-up"}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
          {consultation.patient_ic && <span>IC: {consultation.patient_ic}</span>}
          <span>{dateStr}</span>
        </div>
        {hasDiagnosis && (
          <p className="mt-2 text-sm text-[var(--color-text-main)]">
            <span className="font-medium">Diagnosis:</span>{" "}
            <span className="text-[var(--color-text-muted)]">{diagnosis}</span>
          </p>
        )}
        {!hasDiagnosis && isIncomplete && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {status === "draft" && "Patient selected — ready to upload transcript."}
            {status === "transcribed" && "Transcript attached — ready for AI extraction."}
            {status === "extracting" && "AI extraction in progress…"}
            {status === "ai_extracted" && "Data extracted — ready for your review."}
          </p>
        )}
        {!hasDiagnosis && isApproved && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Consultation completed and approved.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isIncomplete && (
          <button
            onClick={() => onResume(consultation)}
            className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold uppercase"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M8 5.5v13l10-6.5-10-6.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Resume
          </button>
        )}
        {isApproved && (
          <button
            onClick={() => onResume(consultation)}
            className="btn-ghost flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold uppercase"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Review
          </button>
        )}
        <button
          onClick={() => onDelete(consultation)}
          className="btn-danger flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold uppercase"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
