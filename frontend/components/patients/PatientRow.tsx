"use client";

import { patientKey, type Patient } from "@/lib/api";

interface PatientRowProps {
  patient: Patient;
  onView: () => void;
  onDelete: () => void;
}

export default function PatientRow({ patient, onView, onDelete }: PatientRowProps) {
  const initials = patient.name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <li className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition hover:bg-white/40 sm:grid-cols-[2fr_1.5fr_0.5fr_0.8fr_1.2fr_1.4fr] sm:gap-4 sm:px-6">
      {/* Patient (avatar + name) */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
          aria-hidden
        >
          {initials || "?"}
        </span>
        <span className="truncate font-medium">{patient.name}</span>
      </div>

      {/* IC */}
      <div className="min-w-0 text-sm text-[var(--color-text-muted)]">
        <span className="label mr-2 sm:hidden">IC:</span>
        <span className="truncate">{patient.patient_ic}</span>
      </div>

      {/* Age */}
      <div className="text-sm">
        <span className="label mr-2 sm:hidden">Age:</span>
        {patient.age ?? "—"}
      </div>

      {/* Gender */}
      <div className="text-sm">
        <span className="label mr-2 sm:hidden">Gender:</span>
        {patient.gender ?? "—"}
      </div>

      {/* Phone */}
      <div className="min-w-0 text-sm text-[var(--color-text-muted)]">
        <span className="label mr-2 sm:hidden">Phone:</span>
        <span className="truncate">{patient.phone ?? "—"}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 sm:justify-end">
        <button
          onClick={onView}
          className="btn-primary rounded-full px-4 py-2 text-xs font-semibold uppercase"
        >
          View
        </button>
        <button
          onClick={onDelete}
          className="btn-danger rounded-full px-4 py-2 text-xs font-semibold uppercase"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
