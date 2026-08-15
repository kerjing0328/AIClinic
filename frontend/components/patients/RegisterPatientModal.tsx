"use client";

import { useEffect, useRef, useState } from "react";
import { createPatient, type Patient } from "@/lib/api";

type Status = "idle" | "submitting" | "success" | "error";

interface FormState {
  patient_ic: string;
  name: string;
  phone: string;
  address: string;
}

const EMPTY_FORM: FormState = {
  patient_ic: "",
  name: "",
  phone: "",
  address: "",
};

function formatMalaysianIC(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  return digits
    .replace(/^(\d{6})(\d)/, "$1-$2")
    .replace(/^(\d{6})-(\d{2})(\d)/, "$1-$2-$3");
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}

function Field({ id, label, value, onChange, placeholder, type = "text", disabled }: FieldProps & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field w-full rounded-2xl px-5 py-3.5 text-[var(--color-text-main)] disabled:opacity-60"
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--color-text-main)]">{value}</dd>
    </div>
  );
}

export default function RegisterPatientModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered?: (patient: Patient) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  function reset() {
    setForm(EMPTY_FORM);
    setStatus("idle");
    setError("");
    setPatient(null);
  }

  function openForm() {
    reset();
    setStatus("idle");
  }

  function cancel() {
    onClose();
    reset();
  }

  function update(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await createPatient({
        patient_ic: form.patient_ic.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      setPatient(res.patient);
      setStatus("success");
      onRegistered?.(res.patient);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  useEffect(() => {
    if (open && status !== "success") firstFieldRef.current?.focus();
  }, [open, status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) cancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const isSubmitting = status === "submitting";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Register new patient"
    >
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={cancel}
        aria-hidden
      />
      <div
        className="glass relative z-10 w-full max-w-lg p-8 sm:p-10"
        style={{ borderRadius: "var(--radius-panel)", animation: "var(--animate-fade-up)" }}
      >
        {status === "success" ? (
          <div className="flex flex-col items-center text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--color-primary-light)" }}
              aria-hidden
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="var(--color-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight">
              Patient registered
            </h2>
            <p className="mt-3 text-[var(--color-text-muted)]">
              {patient?.name ? (
                <>
                  <span className="font-medium text-[var(--color-text-main)]">
                    {patient.name}
                  </span>{" "}
                  has been added successfully.
                </>
              ) : (
                "The patient has been added successfully."
              )}
            </p>

            {patient && (
              <div className="mt-6 w-full rounded-2xl bg-white/50 p-5 text-left">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {patient.patient_ic && (
                    <Detail label="IC" value={String(patient.patient_ic)} />
                  )}
                  {patient.phone && (
                    <Detail label="Phone" value={String(patient.phone)} />
                  )}
                  {patient.age !== undefined && (
                    <Detail label="Age" value={String(patient.age)} />
                  )}
                  {patient.gender && (
                    <Detail label="Gender" value={String(patient.gender)} />
                  )}
                </dl>
              </div>
            )}

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <button
                onClick={openForm}
                className="btn-primary flex-1 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
              >
                Register Another
              </button>
              <button
                onClick={cancel}
                className="btn-ghost flex-1 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="mb-8">
              <p className="label">New Patient</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Register a new patient
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Fill in the details below and press register.
              </p>
            </div>

            <div className="space-y-5">
              <Field
                ref={firstFieldRef}
                id="patient_ic"
                label="Malaysian IC"
                placeholder="e.g. 900101-14-5678"
                value={form.patient_ic}
                onChange={(v) => update("patient_ic", formatMalaysianIC(v))}
                disabled={isSubmitting}
              />
              <Field
                id="name"
                label="Full Name"
                placeholder="e.g. Nur Aisyah binti Ahmad"
                value={form.name}
                onChange={(v) => update("name", v)}
                disabled={isSubmitting}
              />
              <Field
                id="phone"
                label="Phone"
                type="tel"
                placeholder="e.g. 012-345 6789"
                value={form.phone}
                onChange={(v) => update("phone", v)}
                disabled={isSubmitting}
              />
              <Field
                id="address"
                label="Address"
                placeholder="e.g. 12, Jalan Ampang, KL"
                value={form.address}
                onChange={(v) => update("address", v)}
                disabled={isSubmitting}
              />
            </div>

            {status === "error" && (
              <p
                className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" aria-hidden />
                    Registering…
                  </>
                ) : (
                  "Register"
                )}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={isSubmitting}
                className="btn-ghost flex-1 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
