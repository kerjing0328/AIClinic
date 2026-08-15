"use client";

import { useState } from "react";
import {
  consultationKey,
  medicalReferencePdfUrl,
  type Consultation,
  type AiReviewPayload,
  type AiReviewItem,
} from "@/lib/api";

function extractReviewFromConsultation(c: Consultation): AiReviewPayload | null {
  const raw = c.ai_review as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  // The stored shape is { review: {...}, references: [...] }
  if ("review" in raw) return raw as unknown as AiReviewPayload;
  // Fallback: treat the whole object as the review content
  return { review: raw as unknown as AiReviewPayload["review"] };
}

const SEVERITY_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: "bg-red-100", fg: "text-red-700", label: "Critical" },
  high: { bg: "bg-orange-100", fg: "text-orange-700", label: "High" },
  moderate: { bg: "bg-amber-100", fg: "text-amber-700", label: "Moderate" },
  low: { bg: "bg-emerald-100", fg: "text-emerald-700", label: "Low" },
};

const RISK_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: "bg-red-600", fg: "text-white", label: "Critical Risk" },
  high: { bg: "bg-orange-500", fg: "text-white", label: "High Risk" },
  moderate: { bg: "bg-amber-400", fg: "text-amber-900", label: "Moderate Risk" },
  low: { bg: "bg-emerald-500", fg: "text-white", label: "Low Risk" },
};

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="mb-2.5 flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </h4>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)] ring-1 ring-white/60">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function itemText(item: AiReviewItem): string {
  return (
    item.finding ??
    item.information ??
    item.suggestion ??
    item.recommended_action ??
    item.reason ??
    ""
  );
}

export default function AiReviewPanel({
  consultation,
  canGenerate = true,
  onSaveAndReview,
}: {
  consultation: Consultation;
  canGenerate?: boolean;
  onSaveAndReview?: (
    onSaved: (review: AiReviewPayload) => void,
    onError: (message: string) => void
  ) => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AiReviewPayload | null>(() =>
    extractReviewFromConsultation(consultation)
  );

  const review = result?.review;

  function handleGenerate() {
    if (!onSaveAndReview) return;
    setRunning(true);
    setError("");
    onSaveAndReview(
      (review) => {
        setResult(review);
        setRunning(false);
      },
      (msg) => {
        setError(msg);
        setRunning(false);
      }
    );
  }

  const risk = review?.overall_risk?.toLowerCase() ?? "";
  const riskStyle = RISK_STYLES[risk] ?? RISK_STYLES.low;
  const redFlags = review?.red_flags ?? [];
  const concerns = review?.clinical_concerns ?? [];
  const missing = review?.missing_information ?? [];
  const suggestions = review?.doctor_suggestions ?? [];
  const safetyNetting = review?.safety_netting_suggestions ?? [];

  return (
    <div className="sticky top-8 rounded-3xl border border-[var(--border-glass)] bg-white/40 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-primary-light)" }}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2zM19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6L19 15z"
                stroke="var(--color-primary)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight">AI Suggestions</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Second-pass clinical safety review
            </p>
          </div>
        </div>
        {review && (
          <span
            className={`rounded-full px-3 py-1 text-[9px] text-center font-bold uppercase tracking-wide ${riskStyle.bg} ${riskStyle.fg}`}
            title={`Overall risk: ${review.overall_risk ?? "low"}`}
          >
            {riskStyle.label}
          </span>
        )}
      </div>

      {!review && !running && (
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          title={canGenerate ? undefined : "Complete all mandatory fields first"}
          className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
        >
          Generate AI Review
        </button>
      )}

      {!review && !running && !canGenerate && (
        <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
          Complete all mandatory fields to enable AI review.
        </p>
      )}

      {running && (
        <div className="mt-6 rounded-2xl bg-white/50 p-5 text-center">
          <div className="flex justify-center">
            <span className="spinner spinner-dark" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--color-text-main)]">
            Generating AI review…
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Retrieving references and reviewing the consultation. This can take a minute.
          </p>
        </div>
      )}

      {error && !running && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {review && (
        <div className="mt-4">
          {review.summary && (
            <p className="mt-2 rounded-2xl bg-white/50 p-4 text-sm leading-relaxed text-[var(--color-text-main)]">
              {review.summary}
            </p>
          )}

          {review.requires_prompt_doctor_review && (
            <p className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
              Requires prompt doctor review.
            </p>
          )}

          <Section
            title="Red Flags"
            count={redFlags.length}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                  stroke="#b91c1c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="4" y1="22" x2="4" y2="15" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
          >
            {redFlags.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">None documented.</p>
            ) : (
              <ul className="space-y-3">
                {redFlags.map((rf, i) => {
                  const sev = (rf.severity ?? "moderate").toLowerCase();
                  const style = SEVERITY_STYLES[sev] ?? SEVERITY_STYLES.moderate;
                  return (
                    <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.fg}`}>
                          {style.label}
                        </span>
                      </div>
                      {itemText(rf) && (
                        <p className="mt-2.5 text-sm font-semibold text-[var(--color-text-main)]">
                          {itemText(rf)}
                        </p>
                      )}
                      {rf.reason && (
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                          {rf.reason}
                        </p>
                      )}
                      {rf.recommended_action && (
                        <div className="mt-2.5 flex items-start gap-1.5">
                          <span className="mt-0.5 text-[var(--color-primary)]" aria-hidden>→</span>
                          <p className="text-xs font-medium text-[var(--color-primary)]">
                            {rf.recommended_action}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title="Clinical Concerns"
            count={concerns.length}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 8v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
                  stroke="#d97706"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            {concerns.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">None documented.</p>
            ) : (
              <ul className="space-y-3">
                {concerns.map((c, i) => (
                  <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-4">
                    {itemText(c) && (
                      <p className="text-sm font-medium text-[var(--color-text-main)]">
                        {itemText(c)}
                      </p>
                    )}
                    {c.reason && (
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                        {c.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Missing Information"
            count={missing.length}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="#6b7280" strokeWidth="2" />
                <path d="M21 21l-4.3-4.3M8 11h6" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
          >
            {missing.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">None.</p>
            ) : (
              <ul className="space-y-3">
                {missing.map((m, i) => (
                  <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-4">
                    <p className="text-sm font-medium text-[var(--color-text-main)]">
                      {itemText(m)}
                    </p>
                    {m.why_it_matters && (
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                        {m.why_it_matters}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Doctor Suggestions"
            count={suggestions.length}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            {suggestions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">None.</p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((s, i) => (
                  <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-4">
                    {s.category && (
                      <span className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                        {s.category}
                      </span>
                    )}
                    {itemText(s) && (
                      <p className="mt-2 text-sm font-medium text-[var(--color-text-main)]">
                        {itemText(s)}
                      </p>
                    )}
                    {s.reason && (
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                        {s.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {safetyNetting.length > 0 && (
            <Section
              title="Safety-Netting"
              count={safetyNetting.length}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke="#0d9488"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            >
              <ul className="space-y-2">
                {safetyNetting.map((s, i) => (
                  <li key={i} className="rounded-2xl border border-white/70 bg-white/50 p-3.5 text-sm text-[var(--color-text-main)]">
                    {typeof s === "string" ? s : itemText(s)}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {result?.references && result.references.length > 0 && (
            <Section title="References" count={result.references.length}>
              <ul className="space-y-3">
                {result.references.map((ref, i) => (
                  <li key={i} className="rounded-xl bg-white/40 px-4 py-3">
                    {/* Content text — shown first */}
                    <p className="text-xs leading-relaxed text-[var(--color-text-main)]">
                      {ref.text ?? "—"}
                    </p>

                    {/* Source document link + pages + similarity */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {ref.source && (
                        <a
                          href={medicalReferencePdfUrl(ref.source)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)] transition hover:bg-[var(--color-primary)] hover:text-white"
                          title={`Open ${ref.source} in new tab`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <polyline
                              points="15,3 21,3 21,9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line
                              x1="10"
                              y1="14"
                              x2="21"
                              y2="3"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {ref.source}
                        </a>
                      )}
                      {ref.pages && (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)] ring-1 ring-white/60">
                          Page {ref.pages}
                        </span>
                      )}
                      {ref.similarity !== null && ref.similarity !== undefined && (
                        <span className="text-[10px] font-semibold text-[var(--color-primary)]">
                          {(ref.similarity * 100).toFixed(1)}% match
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <button
            onClick={handleGenerate}
            disabled={running || !canGenerate}
            title={canGenerate ? undefined : "Complete all mandatory fields first"}
            className="btn-ghost mt-6 w-full rounded-full px-6 py-3 text-xs font-semibold uppercase disabled:opacity-50"
          >
            Regenerate Review
          </button>
        </div>
      )}
    </div>
  );
}