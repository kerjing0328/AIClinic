"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getConsultationsByDoctor,
  getConsultation,
  getPatient,
  deleteConsultation,
  consultationKey,
  type Consultation,
} from "@/lib/api";
import { resumeStageFromStatus } from "@/lib/consultation-utils";
import StageContainer from "./StageContainer";
import ConsultationCard from "./ConsultationCard";
import RecordCount from "@/components/shared/RecordCount";
import ConsultationFlow from "./ConsultationFlow";

type View = "list" | "workflow";

export default function ConsultationDashboard({ doctorId }: { doctorId: string }) {
  const [consultations, setConsultations] = useState<
    (Consultation & { patient_name?: string; patient_ic?: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [resumeStage, setResumeStage] = useState<ReturnType<typeof resumeStageFromStatus>>("transcript");
  const [activePatientInfo, setActivePatientInfo] = useState<{ name: string; patient_ic: string; age?: number; gender?: string } | null>(null);

  // Filters
  const [filterName, setFilterName] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [filterDiagnosis, setFilterDiagnosis] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getConsultationsByDoctor(doctorId);
      setConsultations(res?.consultations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load consultations.");
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  const isFiltered = filterName !== "" || filterStatus !== "all" || filterDate !== "all" || filterDiagnosis !== "";

  const filtered = consultations.filter((c) => {
    if (filterName) {
      const name = (c.patient_name ?? "").toLowerCase();
      if (!name.includes(filterName.toLowerCase())) return false;
    }
    if (filterStatus !== "all") {
      const status = (c.status as string) ?? "";
      if (filterStatus === "incomplete" && !["draft", "transcribed", "extracting", "ai_extracted"].includes(status)) return false;
      if (filterStatus === "approved" && !["ai_reviewed", "doctor_approved", "approved"].includes(status)) return false;
      if (filterStatus === "draft" && status !== "draft") return false;
      if (filterStatus === "transcribed" && status !== "transcribed") return false;
      if (filterStatus === "ai_extracted" && status !== "ai_extracted") return false;
    }
    if (filterDiagnosis) {
      const src =
        (c.extracted_data as Record<string, unknown>) ??
        (c.ai_extracted as Record<string, unknown>) ??
        {};
      const assessment = src?.assessment as Record<string, unknown> | undefined;
      const diagnosis = assessment?.diagnosis;
      let diagStr = "";
      if (Array.isArray(diagnosis)) diagStr = diagnosis.join(", ");
      else if (typeof diagnosis === "string") diagStr = diagnosis;
      if (!diagStr.toLowerCase().includes(filterDiagnosis.toLowerCase())) return false;
    }
    if (filterDate !== "all") {
      const dateStr = c.consultation_date ?? c.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();
      if (filterDate === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (d < today) return false;
      } else if (filterDate === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (d < weekAgo) return false;
      } else if (filterDate === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (d < monthAgo) return false;
      }
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedConsultations = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterName, filterStatus, filterDate, filterDiagnosis]);

  async function handleResume(consultation: Consultation & { patient_name?: string; patient_ic?: string }) {
    const stage = resumeStageFromStatus((consultation.status as string) ?? "draft");
    // Fetch patient details first to get age and gender
    try {
      const patientRes = await getPatient(consultation.patient_id);
      setActivePatientInfo({
        name: patientRes.patient.name ?? consultation.patient_name ?? "Unknown Patient",
        patient_ic: patientRes.patient.patient_ic ?? consultation.patient_ic ?? "",
        age: patientRes.patient.age,
        gender: patientRes.patient.gender,
      });
    } catch {
      setActivePatientInfo({
        name: consultation.patient_name ?? "Unknown Patient",
        patient_ic: consultation.patient_ic ?? "",
      });
    }
    try {
      const res = await getConsultation(consultationKey(consultation));
      setActiveConsultation(res.consultation);
    } catch {
      setActiveConsultation(consultation);
    }
    setResumeStage(stage);
    setView("workflow");
  }

  function handleBackToList() {
    setView("list");
    setActiveConsultation(null);
    setActivePatientInfo(null);
    fetchConsultations();
  }

  function handleNewConsultation() {
    setActiveConsultation(null);
    setActivePatientInfo(null);
    setResumeStage("select");
    setView("workflow");
  }

  async function handleDelete(c: Consultation) {
    if (!confirm("Delete this consultation? This action cannot be undone.")) return;
    try {
      await deleteConsultation(consultationKey(c));
      setConsultations((prev) => prev.filter((ct) => consultationKey(ct) !== consultationKey(c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete consultation.");
    }
  }

  function clearFilters() {
    setFilterName("");
    setFilterStatus("all");
    setFilterDate("all");
    setFilterDiagnosis("");
  }

  if (view === "workflow") {
    return (
      <ConsultationFlow
        doctorId={doctorId}
        initialConsultation={activeConsultation}
        initialStage={resumeStage}
        initialPatientInfo={activePatientInfo}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <section className="flex-1 py-14">
      <StageContainer width="wide">
        {/* Header */}
        <div style={{ animation: "var(--animate-fade-up)" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="label">Consultation</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                My Consultations
              </h1>
              <p className="mt-3 text-[var(--color-text-muted)]">
                Review, resume, or start a new consultation session.
              </p>
            </div>
            <button
              onClick={handleNewConsultation}
              className="btn-primary flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 5v14m-7-7h14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              New Consultation
            </button>
          </div>
        </div>

        {/* Filters */}
        <div
          className="mt-8 flex flex-wrap items-center gap-3"
          style={{ animation: "var(--animate-fade-up)", animationDelay: "0.03s" }}
        >
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by patient name…"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="field w-full rounded-full pl-11 pr-5 py-2.5 text-sm text-[var(--color-text-main)]"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="field rounded-full px-5 py-2.5 text-sm text-[var(--color-text-main)]"
          >
            <option value="all">All Status</option>
            <option value="incomplete">Incomplete</option>
            <option value="draft">Draft</option>
            <option value="transcribed">Transcript Ready</option>
            <option value="ai_extracted">Ready for Review</option>
            <option value="approved">Approved</option>
          </select>
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="field rounded-full px-5 py-2.5 text-sm text-[var(--color-text-main)]"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
          </select>
          <input
            type="text"
            placeholder="Filter by diagnosis…"
            value={filterDiagnosis}
            onChange={(e) => setFilterDiagnosis(e.target.value)}
            className="field min-w-[180px] rounded-full px-5 py-2.5 text-sm text-[var(--color-text-main)]"
          />
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-medium text-[var(--color-text-muted)] transition hover:bg-white/60 hover:text-[var(--color-text-main)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* Record count */}
        <div className="mt-6" style={{ animation: "var(--animate-fade-up)", animationDelay: "0.05s" }}>
          {!loading && !error && consultations.length > 0 && (
            <div className="mb-3">
              <RecordCount
                count={filtered.length}
                total={consultations.length}
                label="record"
                isFiltered={isFiltered}
              />
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-[var(--color-text-muted)]">
              <span className="spinner spinner-dark" aria-hidden />
              Loading consultations…
            </div>
          ) : error ? (
            <div className="glass rounded-3xl p-10 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchConsultations}
                className="btn-ghost mt-4 rounded-full px-6 py-2.5 text-sm font-semibold uppercase"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center">
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "var(--color-primary-light)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-lg font-semibold text-[var(--color-text-main)]">
                {consultations.length === 0 ? "No consultations yet" : "No matching consultations"}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {consultations.length === 0
                  ? "Start your first consultation to begin."
                  : "Try adjusting your filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedConsultations.map((c) => (
                <ConsultationCard
                  key={String(consultationKey(c))}
                  consultation={c}
                  onResume={handleResume}
                  onDelete={handleDelete}
                />
              ))}
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
      </StageContainer>
    </section>
  );
}
