"use client";

import { useEffect, useState } from "react";
import { getConsultationsByPatient, patientKey, type Patient, type Consultation } from "@/lib/api";
import ModalShell from "./ModalShell";

function formatDate(value?: string) {
  if (!value) return "Date not available";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--color-text-main)] break-words">{value}</dd>
    </div>
  );
}

interface ViewModalProps {
  patient: Patient;
  onClose: () => void;
  onEdit: () => void;
}

export default function ViewModal({ patient, onClose, onEdit }: ViewModalProps) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getConsultationsByPatient(patientKey(patient));
        if (active) setConsultations(res.consultations ?? []);
      } catch (err) {
        if (active)
          setError(err instanceof Error ? err.message : "Failed to load consultations.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patient]);

  return (
    <ModalShell onClose={onClose} label="Patient details">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">Patient</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{patient.name}</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">{patient.patient_ic}</p>
        </div>
        <button
          onClick={onEdit}
          className="btn-ghost rounded-full px-5 py-2.5 text-xs font-semibold uppercase"
        >
          Edit
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-white/50 p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          {patient.age !== undefined && <Detail label="Age" value={String(patient.age)} />}
          {patient.gender && <Detail label="Gender" value={String(patient.gender)} />}
          {patient.phone && <Detail label="Phone" value={String(patient.phone)} />}
          {patient.address && (
            <Detail
              label="Address"
              value={String(patient.address)}
              className="col-span-2 sm:col-span-3"
            />
          )}
        </dl>
      </div>

      {/* Consultations linked to this patient */}
      <div className="mt-7">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Consultation history</h3>
          {!loading && !error && (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
            >
              {consultations.length} record{consultations.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center gap-3 py-6 text-sm text-[var(--color-text-muted)]">
              <span className="spinner spinner-dark" aria-hidden />
              Loading consultations…
            </div>
          ) : error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : consultations.length === 0 ? (
            <p className="rounded-2xl bg-white/40 px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
              No consultations recorded for this patient yet.
            </p>
          ) : (
            consultations.map((c) => {
              const cid = c.consultation_id ?? c.id;
              return (
                <div
                  key={String(cid)}
                  className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(c.consultation_date ?? c.created_at)}
                    </p>
                  </div>
                  {c.status && (
                    <span className="shrink-0 rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
                      {c.status}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={onClose}
          className="btn-ghost rounded-full px-7 py-3 text-sm font-semibold uppercase"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
