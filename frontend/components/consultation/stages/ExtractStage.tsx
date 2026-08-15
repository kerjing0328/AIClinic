"use client";

import { useState } from "react";
import { setAiExtracted, getAiExtracted, consultationKey, type Consultation } from "@/lib/api";

export default function ExtractStage({
  consultation,
  onBack,
  onForward,
  onExtracted,
}: {
  consultation: Consultation;
  transcript: string;
  onBack: () => void;
  onForward?: () => void;
  onExtracted: (c: Consultation) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function startExtraction() {
    setRunning(true);
    setError("");
    setProgress(0);

    const started = Date.now();
    const DURATION = 180_000;
    const timer = setInterval(() => {
      setProgress(Math.min(90, ((Date.now() - started) / DURATION) * 100));
    }, 500);

    try {
      await setAiExtracted(consultationKey(consultation));
      const extracted = await pollUntilExtracted(consultationKey(consultation));

      clearInterval(timer);
      setProgress(100);
      setTimeout(
        () => onExtracted({ ...consultation, status: "ai_extracted", extracted_data: extracted }),
        400
      );
    } catch (err) {
      clearInterval(timer);
      setProgress(0);
      setError(err instanceof Error ? err.message : "AI extraction failed.");
      setRunning(false);
    }
  }

  async function pollUntilExtracted(id: string | number) {
    const MAX_MS = 360_000;
    const INTERVAL = 4000;
    const start = Date.now();
    while (Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, INTERVAL));
      try {
        const res = await getAiExtracted(id);
        if (res?.status === "ai_extracted" && res.extracted_data) {
          return res.extracted_data;
        }
      } catch {
        /* transient blip — keep polling */
      }
    }
    throw new Error("Extraction timed out. Please try again.");
  }

  const alreadyExtracted =
    consultation.status === "ai_extracted" && consultation.extracted_data;

  return (
    <>
      <div className="glass w-full p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
        <h2 className="text-2xl font-semibold tracking-tight">AI extraction</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          The AI will read the transcript and extract structured clinical data.
        </p>

        {!running ? (
          <>
            <div className="mt-7 rounded-2xl bg-white/50 p-5 text-sm text-[var(--color-text-muted)]">
              {alreadyExtracted ? (
                <>
                  <p className="font-medium text-[var(--color-text-main)]">
                    Consultation data has been extracted ✓
                  </p>
                  <p className="mt-2">
                    Click <span className="font-semibold">Restart Extraction</span> to re-extract the data (this will take another moment).
                    Or click <span className="font-semibold">Next</span> to review the extracted data.
                  </p>
                </>
              ) : (
                <>Transcript attached ✓ — ready to extract. This typically takes about
                <span className="font-semibold text-[var(--color-text-main)]"> 1-2 minutes</span>.</>
              )}
            </div>
            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <div className="mt-8 flex justify-center">
              <button
                onClick={startExtraction}
                className="btn-primary rounded-full px-8 py-3.5 text-sm font-semibold uppercase"
              >
                {alreadyExtracted ? "Restart Extraction" : "Start AI Extraction"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--color-text-main)]">
                Extracting clinical data…
              </span>
              <span className="text-[var(--color-text-muted)]">{Math.round(progress)}%</span>
            </div>

            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%`, background: "var(--color-primary)" }}
              />
            </div>

            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <span className="spinner spinner-dark" aria-hidden />
              Expected ~1-2 minutes. Please wait — do not close this window.
            </p>
          </div>
        )}
      </div>

      {!running && (
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
          <div className="flex-1" />
          {onForward && (
            <button
              onClick={onForward}
              className="btn-primary flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );
}
