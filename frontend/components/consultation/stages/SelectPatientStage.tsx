"use client";

import { useEffect, useState } from "react";
import { getPatients, createConsultation, patientKey, type Patient, type Consultation } from "@/lib/api";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--color-text-main)] break-words">{value}</dd>
    </div>
  );
}

export default function SelectPatientStage({
  doctorId,
  initialPatientId,
  onCreated,
}: {
  doctorId: string;
  initialPatientId?: string;
  onCreated: (c: Consultation, patient: { name: string; patient_ic: string; age?: number; gender?: string }) => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(initialPatientId ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getPatients();
        setPatients(res?.patients ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patients.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleConfirm() {
    if (!selectedId || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await createConsultation(selectedId, doctorId);
      onCreated(res.consultation, {
        name: selected.name,
        patient_ic: selected.patient_ic,
        age: selected.age,
        gender: selected.gender,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create consultation.");
      setSubmitting(false);
    }
  }

  const selected = patients.find((p) => String(patientKey(p)) === selectedId);

  return (
    <div className="glass w-full p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
      <h2 className="text-2xl font-semibold tracking-tight">Select a patient</h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Choose a registered patient to begin the consultation.
      </p>

      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-[var(--color-text-muted)]">
          <span className="spinner spinner-dark" aria-hidden />
          Loading patients…
        </div>
      ) : (
        <>
          <div className="mt-8">
            <label htmlFor="patient" className="label mb-2 block">
              Patient
            </label>
            <select
              id="patient"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={submitting}
              className="field w-full rounded-2xl px-5 py-3.5 text-[var(--color-text-main)] disabled:opacity-60"
            >
              <option value="">— Select a patient —</option>
              {patients.map((p) => (
                <option key={String(patientKey(p))} value={String(patientKey(p))}>
                  {p.name} · {p.patient_ic}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="mt-5 rounded-2xl bg-white/50 p-5">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                {selected.age !== undefined && <Detail label="Age" value={String(selected.age)} />}
                {selected.gender && <Detail label="Gender" value={String(selected.gender)} />}
                {selected.phone && <Detail label="Phone" value={String(selected.phone)} />}
                {selected.patient_ic && <Detail label="IC" value={String(selected.patient_ic)} />}
              </dl>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="mt-8">
            <button
              onClick={handleConfirm}
              disabled={!selectedId || submitting}
              className="btn-primary flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="spinner" aria-hidden />
                  Creating…
                </>
              ) : (
                "Confirm & Start"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
