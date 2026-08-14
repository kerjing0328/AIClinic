"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
    getPatients,
    getConsultationsByPatient,
    updatePatient,
    patientKey,
    type Patient,
    type Consultation,
} from "@/lib/api";

type ModalMode = "view" | "edit" | null;

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");

    const [selected, setSelected] = useState<Patient | null>(null);
    const [mode, setMode] = useState<ModalMode>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getPatients();
            setPatients(res.patients ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load patients.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    function openView(p: Patient) {
        setSelected(p);
        setMode("view");
    }
    function openEdit(p: Patient) {
        setSelected(p);
        setMode("edit");
    }
    function closeModal() {
        setMode(null);
        setSelected(null);
    }

    function handleSaved(updated: Patient) {
        setPatients((prev) =>
            prev.map((p) => (patientKey(p) === patientKey(updated) ? updated : p))
        );
        setSelected(updated);
        setMode("view");
    }

    const filtered = patients.filter((p) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
            p.name?.toLowerCase().includes(q) ||
            p.patient_ic?.toLowerCase().includes(q) ||
            p.phone?.toLowerCase().includes(q)
        );
    });

    return (
        <>
            <section className="flex-1 py-14">
                {/* Header */}
                <div
                    className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
                    style={{ animation: "var(--animate-fade-up)" }}
                >
                    <div>
                        <p className="label">Reception</p>
                        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                            Patients Database
                        </h1>
                        <p className="mt-3 max-w-xl text-[var(--color-text-muted)]">
                            View, search and manage registered patients and their
                            consultation history.
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-8" style={{ animation: "var(--animate-fade-up)", animationDelay: "0.05s" }}>
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name, IC or phone…"
                        className="field w-full max-w-md rounded-full px-6 py-3.5 text-[var(--color-text-main)]"
                        aria-label="Search patients"
                    />
                </div>

                {/* Content */}
                <div className="mt-8" style={{ animation: "var(--animate-fade-up)", animationDelay: "0.1s" }}>
                    {loading ? (
                        <div className="glass flex items-center justify-center gap-3 rounded-[var(--radius-panel)] p-16 text-[var(--color-text-muted)]">
                            <span className="spinner spinner-dark" aria-hidden />
                            Loading patients…
                        </div>
                    ) : error ? (
                        <div className="glass rounded-[var(--radius-panel)] p-10 text-center">
                            <p className="text-red-700">{error}</p>
                            <button
                                onClick={load}
                                className="btn-ghost mt-5 rounded-full px-6 py-3 text-sm font-semibold uppercase"
                            >
                                Retry
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="glass rounded-[var(--radius-panel)] p-16 text-center">
                            <h3 className="text-xl font-semibold">No patients found</h3>
                            <p className="mt-2 text-[var(--color-text-muted)]">
                                {query
                                    ? "Try a different search term."
                                    : "Register your first patient to get started."}
                            </p>
                            {!query && (
                                <Link
                                    href="/"
                                    className="btn-primary mt-6 inline-block rounded-full px-7 py-3.5 text-sm font-semibold uppercase"
                                >
                                    Create Patient
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div
                            className="glass overflow-hidden"
                            style={{ borderRadius: "var(--radius-xl)" }}
                        >
                            {/* Table header (desktop) */}
                            <div className="hidden grid-cols-[2fr_1.5fr_0.5fr_0.8fr_1.2fr_1.4fr] items-center gap-4 border-b border-white/60 px-6 py-4 sm:grid">
                                <span className="label">Patient</span>
                                <span className="label">IC</span>
                                <span className="label">Age</span>
                                <span className="label">Gender</span>
                                <span className="label">Phone</span>
                                <span className="label text-right">Actions</span>
                            </div>

                            {/* Rows */}
                            <ul className="divide-y divide-white/50">
                                {filtered.map((p) => (
                                    <PatientRow
                                        key={String(patientKey(p))}
                                        patient={p}
                                        onView={() => openView(p)}
                                        onEdit={() => openEdit(p)}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}

                    {!loading && !error && filtered.length > 0 && (
                        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                            Showing {filtered.length} patient{filtered.length === 1 ? "" : "s"}.
                        </p>
                    )}
                </div>
            </section>

            {/* Modals */}
            {mode === "view" && selected && (
                <ViewModal patient={selected} onClose={closeModal} onEdit={() => setMode("edit")} />
            )}
            {mode === "edit" && selected && (
                <EditModal patient={selected} onClose={closeModal} onSaved={handleSaved} />
            )}
        </>
    );
}

/* ============================================================
   Patient row (list item)
   ============================================================ */

function PatientRow({
    patient,
    onView,
    onEdit,
}: {
    patient: Patient;
    onView: () => void;
    onEdit: () => void;
}) {
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
                    onClick={onEdit}
                    className="btn-ghost rounded-full px-4 py-2 text-xs font-semibold uppercase"
                >
                    Edit
                </button>
            </div>
        </li>
    );
}

/* ============================================================
   View modal — details + linked consultations
   ============================================================ */
function ViewModal({
    patient,
    onClose,
    onEdit,
}: {
    patient: Patient;
    onClose: () => void;
    onEdit: () => void;
}) {
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
                                        {/* <p className="truncate text-sm font-medium">
                      {String(cid)}
                    </p> */}
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

/* ============================================================
   Edit modal — update patient details
   ============================================================ */
function EditModal({
    patient,
    onClose,
    onSaved,
}: {
    patient: Patient;
    onClose: () => void;
    onSaved: (p: Patient) => void;
}) {
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

/* ============================================================
   Shared bits
   ============================================================ */
function ModalShell({
    children,
    onClose,
    label,
}: {
    children: React.ReactNode;
    onClose?: () => void;
    label: string;
}) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && onClose) onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={label}
        >
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden
            />
            <div
                className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-8 sm:p-10"
                style={{ borderRadius: "var(--radius-panel)", animation: "var(--animate-fade-up)" }}
            >
                {children}
            </div>
        </div>
    );
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
            <dd className="mt-1 font-medium text-[var(--color-text-main)] break-words">
                {value}
            </dd>
        </div>
    );
}

const EditField = ({
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
}) => (
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
