"use client";

import { useMemo, useState } from "react";
import {
  consultationKey,
  downloadConsultationReport,
  type Consultation,
  type AiReviewContent,
  type AiReviewItem,
} from "@/lib/api";
import { flatten, childrenOf, lastSeg, prettyLabel, soapGroups } from "@/lib/consultation-utils";

export default function ReportStage({
  consultation,
  onBack,
}: {
  consultation: Consultation;
  onBack: () => void;
  onNew: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const note = useMemo<Record<string, unknown>>(() => {
    let src =
      (consultation.final_note as Record<string, unknown>) ??
      (consultation.ai_extracted as Record<string, unknown>) ??
      (consultation.extracted_data as Record<string, unknown>) ??
      {};
    if (
      src &&
      typeof src === "object" &&
      Object.keys(src).length === 1 &&
      "extracted_data" in src &&
      typeof (src as Record<string, unknown>).extracted_data === "object"
    ) {
      src = (src as Record<string, unknown>).extracted_data as Record<string, unknown>;
    }
    return src;
  }, [consultation]);

  const aiReview = useMemo<AiReviewContent | null>(() => {
    const raw = consultation.ai_review as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object") return null;
    if ("review" in raw && typeof (raw as Record<string, unknown>).review === "object") {
      return (raw as Record<string, unknown>).review as AiReviewContent;
    }
    return raw as unknown as AiReviewContent;
  }, [consultation]);

  const fields = useMemo(() => flatten(note), [note]);

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      await downloadConsultationReport(consultationKey(consultation));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download report.");
    } finally {
      setDownloading(false);
    }
  }

  const hasSoap = useMemo(() => {
    const src =
      (consultation.final_note as Record<string, unknown>) ??
      (consultation.ai_extracted as Record<string, unknown>) ??
      (consultation.extracted_data as Record<string, unknown>) ??
      {};
    const unwrapped =
      src && typeof src === "object" && Object.keys(src).length === 1 && "extracted_data" in src
        ? (src as Record<string, unknown>).extracted_data
        : src;
    return unwrapped && typeof unwrapped === "object" && "SOAP" in unwrapped;
  }, [consultation]);

  const groups = useMemo(() => soapGroups(note), [note]);

  function ReadRows({ keys }: { keys: string[] }) {
    return (
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {keys.map((k) => {
          const value = fields[k];
          const long = value.length > 60 || lastSeg(k).toLowerCase().includes("note");
          return (
            <div key={k} className={long ? "sm:col-span-2" : ""}>
              <dt className="label">{prettyLabel(lastSeg(k))}</dt>
              <dd className="mt-1 whitespace-pre-wrap font-medium text-[var(--color-text-main)] break-words">
                {value.trim() ? value : "—"}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  function renderSoapGroups() {
    return (
      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.heading} className="rounded-3xl bg-white/50 p-6">
            <div className="mb-3 border-b border-white/60 pb-2">
              <h3 className="text-lg font-semibold tracking-tight">{g.heading}</h3>
            </div>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {g.fields.map((f) => {
                const long = f.value.length > 60 || f.key.toLowerCase().includes("note");
                return (
                  <div key={f.flatKey} className={long ? "sm:col-span-2" : ""}>
                    <dt className="label">{prettyLabel(f.key)}</dt>
                    <dd className="mt-1 whitespace-pre-wrap font-medium text-[var(--color-text-main)] break-words">
                      {f.value.trim() ? f.value : "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    );
  }

  function ReadGroup(prefix: string, depth: number): React.ReactNode {
    const { leaves, subgroups } = childrenOf(fields, prefix);

    if (prefix === "") {
      return (
        <div className="space-y-6">
          {leaves.length > 0 && (
            <div className="rounded-3xl bg-white/50 p-6">
              <div className="mb-3 border-b border-white/60 pb-2">
                <h3 className="text-lg font-semibold tracking-tight">General</h3>
              </div>
              <ReadRows keys={leaves} />
            </div>
          )}
          {subgroups.map((sg) => (
            <div key={sg}>{ReadGroup(sg, 1)}</div>
          ))}
        </div>
      );
    }

    return (
      <div
        key={prefix}
        className={
          depth === 1
            ? "rounded-3xl bg-white/50 p-6"
            : "mt-5 rounded-2xl border border-white/60 bg-white/30 p-5"
        }
      >
        <div className={`mb-3 ${depth === 1 ? "border-b border-white/60 pb-2" : ""}`}>
          <h3
            className={
              depth === 1
                ? "text-lg font-semibold tracking-tight"
                : "text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
            }
          >
            {prettyLabel(lastSeg(prefix))}
          </h3>
        </div>
        {leaves.length > 0 && <ReadRows keys={leaves} />}
        {subgroups.map((sg) => (
          <div key={sg}>{ReadGroup(sg, depth + 1)}</div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="glass w-full max-w-7xl p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--color-primary-light)" }}
              aria-hidden
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="var(--color-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="label">Approved · Read-only</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                Consultation Report
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Consultation #{String(consultationKey(consultation))} · finalised note.
              </p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold uppercase disabled:opacity-60"
          >
            {downloading ? (
              <>
                <span className="spinner" aria-hidden />
                Preparing…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {/* Report body (read-only, grouped) */}
        <div className="mt-8">
          {Object.keys(fields).length === 0 ? (
            <p className="text-[var(--color-text-muted)]">No clinical data available.</p>
          ) : hasSoap ? (
            renderSoapGroups()
          ) : (
            ReadGroup("", 0)
          )}
        </div>

        {/* AI Review (if previously generated) */}
        {aiReview && (
          <div className="mt-8 rounded-3xl border border-white/60 bg-white/30 p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-white/60 pb-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--color-primary-light)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z"
                    stroke="var(--color-primary)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">AI Review</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Second-pass clinical safety review
                </p>
              </div>
              {aiReview.overall_risk && (
                <span className="ml-auto rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                  {aiReview.overall_risk} risk
                </span>
              )}
            </div>

            {aiReview.summary && (
              <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-main)]">
                {aiReview.summary}
              </p>
            )}

            {aiReview.red_flags && aiReview.red_flags.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">
                  Red Flags
                </h4>
                <ul className="space-y-2">
                  {aiReview.red_flags.map((rf: AiReviewItem, i: number) => (
                    <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-3">
                      {rf.finding && (
                        <p className="text-sm font-medium text-[var(--color-text-main)]">
                          {rf.finding}
                        </p>
                      )}
                      {rf.reason && (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{rf.reason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiReview.doctor_suggestions && aiReview.doctor_suggestions.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                  Suggestions
                </h4>
                <ul className="space-y-2">
                  {aiReview.doctor_suggestions.map((s: AiReviewItem, i: number) => (
                    <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-3 text-sm text-[var(--color-text-main)]">
                      {s.suggestion ?? s.finding ?? ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons outside card */}
      <div className="mt-4 flex items-center">
        <button
          onClick={onBack}
          className="btn-ghost flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>
    </>
  );
}
