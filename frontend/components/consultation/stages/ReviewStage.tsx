"use client";

import { useMemo, useState } from "react";
import { setDoctorApproved, consultationKey, type Consultation } from "@/lib/api";
import {
  flatten,
  unflatten,
  childrenOf,
  flagsUnder,
  isMandatory,
  lastSeg,
  prettyLabel,
  prettyPath,
  SAMPLE_EXTRACTED,
} from "@/lib/consultation-utils";

export default function ReviewStage({
  consultation,
  onBack,
  onForward,
  onApproved,
}: {
  consultation: Consultation;
  onBack: () => void;
  onForward?: () => void;
  onApproved: (c: Consultation) => void;
}) {
  const extracted = useMemo<Record<string, unknown>>(() => {
    let src =
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
    return Object.keys(src).length ? src : SAMPLE_EXTRACTED;
  }, [consultation]);

  const [fields, setFields] = useState<Record<string, string>>(() => flatten(extracted));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

  function update(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const redFlags = useMemo(
    () =>
      Object.entries(fields)
        .filter(([key, value]) => isMandatory(key) && value.trim() === "")
        .map(([key]) => key),
    [fields]
  );
  const hasRedFlags = redFlags.length > 0;

  async function handleSave() {
    setAttempted(true);
    if (hasRedFlags) {
      setError("Please complete all mandatory fields flagged in red before approving.");
      const el = document.getElementById(redFlags[0]);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const finalNote = unflatten(fields);
      const res = await setDoctorApproved(consultationKey(consultation), finalNote);
      window.scrollTo({ top: 0, behavior: "smooth" });
      onApproved(res.consultation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
      setSaving(false);
    }
  }

  function LeafField(fullKey: string, value: string) {
    const long = value.length > 60 || lastSeg(fullKey).toLowerCase().includes("note");
    const mandatory = isMandatory(fullKey);
    const flagged = mandatory && value.trim() === "";
    const cls = `field w-full rounded-2xl px-5 py-3.5 text-[var(--color-text-main)] disabled:opacity-60 ${
      flagged ? "!border-red-400 !outline-red-400" : ""
    }`;
    const style = flagged ? { boxShadow: "0 0 0 3px rgba(248,113,113,0.25)" } : undefined;
    return (
      <div key={fullKey} className={long ? "sm:col-span-2" : ""}>
        <label
          htmlFor={fullKey}
          className={`label mb-2 flex items-center gap-1 ${flagged ? "!text-red-600" : ""}`}
        >
          {prettyLabel(lastSeg(fullKey))}
          {mandatory && <span className="text-red-600">*</span>}
          {flagged && (
            <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              Required
            </span>
          )}
        </label>
        {long ? (
          <textarea
            id={fullKey}
            rows={3}
            value={value}
            disabled={saving}
            onChange={(e) => update(fullKey, e.target.value)}
            className={cls}
            style={style}
          />
        ) : (
          <input
            id={fullKey}
            value={value}
            disabled={saving}
            onChange={(e) => update(fullKey, e.target.value)}
            className={cls}
            style={style}
          />
        )}
        {flagged && (
          <p className="mt-1.5 text-xs text-red-600">
            This field is mandatory and cannot be empty.
          </p>
        )}
      </div>
    );
  }

  function renderGroup(prefix: string, depth: number): React.ReactNode {
    const { leaves, subgroups } = childrenOf(fields, prefix);

    if (prefix === "") {
      return (
        <div className="space-y-6">
          {leaves.length > 0 && (
            <div className="rounded-3xl bg-white/40 p-6">
              <div className="mb-4 border-b border-white/60 pb-2">
                <h3 className="text-lg font-semibold tracking-tight">General</h3>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {leaves.map((k) => LeafField(k, fields[k]))}
              </div>
            </div>
          )}
          {subgroups.map((sg) => renderGroup(sg, 1))}
        </div>
      );
    }

    const missing = flagsUnder(fields, prefix);
    const heading = (
      <div
        className={`mb-4 flex items-center gap-3 ${
          depth === 1 ? "border-b border-white/60 pb-2" : ""
        }`}
      >
        <h3
          className={
            depth === 1
              ? "text-lg font-semibold tracking-tight"
              : "text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
          }
        >
          {prettyLabel(lastSeg(prefix))}
        </h3>
        {missing > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
            {missing} required
          </span>
        )}
      </div>
    );

    const body = (
      <>
        {leaves.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {leaves.map((k) => LeafField(k, fields[k]))}
          </div>
        )}
        {subgroups.map((sg) => (
          <div key={sg} className="mt-6">
            {renderGroup(sg, depth + 1)}
          </div>
        ))}
      </>
    );

    return (
      <div
        key={prefix}
        className={
          depth === 1
            ? "rounded-3xl bg-white/40 p-6"
            : "rounded-2xl border border-white/60 bg-white/30 p-5"
        }
      >
        {heading}
        {body}
      </div>
    );
  }

  return (
    <>
      <div className="glass w-full p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Review & Edit</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              AI-extracted content may be inaccurate. Please review before finalising. Fields marked{" "}
              <span className="font-semibold text-red-600">*</span> are mandatory.
            </p>
          </div>
          <div
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              hasRedFlags
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
            }`}
          >
            {hasRedFlags
              ? `⚠ ${redFlags.length} red flag${redFlags.length > 1 ? "s" : ""} — action required`
              : "✓ All mandatory fields complete"}
          </div>
        </div>

        {attempted && hasRedFlags && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-sm font-semibold text-red-700">Missing mandatory information:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
              {redFlags.map((k) => (
                <li key={k}>{prettyPath(k)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">{renderGroup("", 0)}</div>

        {error && (
          <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {hasRedFlags && (
          <p className="mt-4 text-sm text-red-600">
            Resolve {redFlags.length} required field{redFlags.length > 1 ? "s" : ""} to continue.
          </p>
        )}
      </div>

      {/* Navigation buttons outside card */}
      <div className="mt-4 flex items-center">
        <button
          onClick={onBack}
          disabled={saving}
          className="btn-ghost flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving || hasRedFlags}
          title={hasRedFlags ? "Resolve all red flags before approving" : undefined}
          className="btn-primary flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="spinner" aria-hidden />
              Saving…
            </>
          ) : (
            "Save & Approve"
          )}
        </button>
      </div>
    </>
  );
}
