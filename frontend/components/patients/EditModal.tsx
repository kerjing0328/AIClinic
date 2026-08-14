"use client";

import { useState } from "react";
import { updatePatient, patientKey, type Patient } from "@/lib/api";
import ModalShell from "./ModalShell";

function EditField({
  id,
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="field w-full rounded-2xl px-5 py-3.5 text-[var(--color-text-main)] disabled:opacity-60"
      />
    </div>
  );
}

interface EditModalProps {
  patient: Patient;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}

export default function EditModal({ patient, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    patient_ic: patient.patient_ic ?? "",
    name: patient.name ?? "",
    phone: patient.phone ?? "",
    address: patient.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await updatePatient(patientKey(patient), {
        patient_ic: form.patient_ic.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      onSaved(res.patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update patient.");
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={saving ? undefined : onClose} label="Edit patient">
      <form onSubmit={handleSubmit}>
        <div className="mb-7">
          <p className="label">Edit</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            Update patient data
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Age and gender re-derive automatically from the IC on save.
          </p>
        </div>

        <div className="space-y-5">
          <EditField id="e_ic" label="Malaysian IC" value={form.patient_ic} onChange={(v) => update("patient_ic", v)} disabled={saving} />
          <EditField id="e_name" label="Full Name" value={form.name} onChange={(v) => update("name", v)} disabled={saving} />
          <EditField id="e_phone" label="Phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} disabled={saving} />
          <EditField id="e_address" label="Address" value={form.address} onChange={(v) => update("address", v)} disabled={saving} />
        </div>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
          >
            {saving ? (
              <>
                <span className="spinner" aria-hidden />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-ghost flex-1 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
