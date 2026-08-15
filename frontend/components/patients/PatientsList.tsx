"use client";

import { useCallback, useEffect, useState } from "react";
import { getPatients, deletePatient, patientKey, type Patient } from "@/lib/api";
import RecordCount from "@/components/shared/RecordCount";
import PatientRow from "./PatientRow";
import ViewModal from "./ViewModal";
import EditModal from "./EditModal";
import RegisterPatientModal from "./RegisterPatientModal";

type ModalMode = "view" | "edit" | null;

export default function PatientsList() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [selected, setSelected] = useState<Patient | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);
  const [showRegister, setShowRegister] = useState(false);

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

  function handleRegistered(newPatient: Patient) {
    setPatients((prev) => [...prev, newPatient]);
    setShowRegister(false);
  }

  async function handleDelete(p: Patient) {
    if (!confirm(`Delete patient "${p.name}"? This action cannot be undone.`)) return;
    try {
      await deletePatient(patientKey(p));
      setPatients((prev) => prev.filter((pt) => patientKey(pt) !== patientKey(p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete patient.");
    }
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

  const isFiltered = query.trim() !== "";

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedPatients = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  return (
    <>
      <section className="flex-1 py-14">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
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
              <button
                onClick={() => setShowRegister(true)}
                className="btn-primary flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm font-semibold uppercase sm:self-auto"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                Add Patient
              </button>
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
              {/* Record count — placed ABOVE the list */}
              {!loading && !error && patients.length > 0 && (
                <div className="mb-4">
                  <RecordCount
                    count={filtered.length}
                    total={patients.length}
                    label="patient"
                    isFiltered={isFiltered}
                  />
                </div>
              )}

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
                    <button
                      onClick={() => setShowRegister(true)}
                      className="btn-primary mt-6 inline-block rounded-full px-7 py-3.5 text-sm font-semibold uppercase"
                    >
                      Create Patient
                    </button>
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
                    {paginatedPatients.map((p) => (
                      <PatientRow
                        key={String(patientKey(p))}
                        patient={p}
                        onView={() => openView(p)}
                        onDelete={() => handleDelete(p)}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* Pagination */}
              {!loading && !error && filtered.length > 0 && totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/60 text-[var(--color-text-main)]"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                      if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                        acc.push("ellipsis");
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span key={`e-${idx}`} className="px-2 text-[var(--color-text-muted)]">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item)}
                          className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                            currentPage === item
                              ? "bg-[var(--color-primary)] text-white"
                              : "hover:bg-white/60 text-[var(--color-text-main)]"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/60 text-[var(--color-text-main)]"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      {mode === "view" && selected && (
        <ViewModal patient={selected} onClose={closeModal} onEdit={() => setMode("edit")} />
      )}
      {mode === "edit" && selected && (
        <EditModal patient={selected} onClose={closeModal} onSaved={handleSaved} />
      )}
      <RegisterPatientModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onRegistered={handleRegistered}
      />
    </>
  );
}
