"use client";

import { useMemo, useRef, useState } from "react";
import { setTranscribed, consultationKey, type Consultation } from "@/lib/api";
import { parseTranscript, type Turn } from "@/lib/transcript";

export default function TranscriptStage({
  consultation,
  initialTranscript,
  onBack,
  onForward,
  onTranscribed,
}: {
  consultation: Consultation;
  initialTranscript?: string;
  onBack: () => void;
  onForward?: () => void;
  onTranscribed: (c: Consultation, raw: string) => void;
}) {
  const [raw, setRaw] = useState(initialTranscript ?? "");
  const [fileName, setFileName] = useState(initialTranscript ? "transcript.txt" : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const turns: Turn[] = useMemo(() => (raw ? parseTranscript(raw) : []), [raw]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    try {
      const text = await file.text();
      setRaw(text);
    } catch {
      setError("Could not read the file. Please try another.");
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const path = fileName || `consultation_${consultationKey(consultation)}.txt`;
      const res = await setTranscribed(consultationKey(consultation), path, raw);
      onTranscribed(res.consultation, raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach transcript.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* LEFT — upload card */}
        <div className="glass flex flex-col p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
          <h2 className="text-2xl font-semibold tracking-tight">Upload transcript</h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Upload the recorded consultation transcript (.txt). It will appear as a
            conversation on the right for you to confirm.
          </p>

          <div
            className="mt-7 flex-1 cursor-pointer rounded-3xl border-2 border-dashed border-white/80 bg-white/40 p-8 text-center transition hover:bg-white/60"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            <div className="flex h-full flex-col items-center justify-center">
              <span
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
                aria-hidden
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 16V4m0 0L8 8m4-4l4 4M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="font-medium text-[var(--color-text-main)]">
                {fileName ? fileName : "Click to upload transcript"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Format: lines like "Doctor: …" and "Patient: …"
              </p>
            </div>
          </div>

          {fileName && (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-primary)]">
              <span aria-hidden>✓</span> {turns.length} lines parsed from{" "}
              <span className="font-medium">{fileName}</span>
            </p>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="mt-8">
            <button
              onClick={handleConfirm}
              disabled={!raw || submitting}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="spinner" aria-hidden />
                  Saving…
                </>
              ) : (
                "Confirm Transcript"
              )}
            </button>
          </div>
        </div>

        {/* RIGHT — transcript loaded (chat) */}
        <div className="glass flex flex-col p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Conversation</h3>
            {turns.length > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
              >
                {turns.length} lines
              </span>
            )}
          </div>

          <div
            className="mt-5 flex-1 space-y-3 overflow-y-auto rounded-3xl bg-white/40 p-5"
            style={{ maxHeight: "32rem", minHeight: "18rem" }}
          >
            {turns.length === 0 ? (
              <div className="flex h-full min-h-[16rem] flex-col items-center justify-center text-center text-sm text-[var(--color-text-muted)]">
                <span className="mb-2 text-2xl" aria-hidden>
                  💬
                </span>
                No transcript loaded yet.
                <br /> Upload a file to preview the conversation here.
              </div>
            ) : (
              turns.map((t, i) => {
                const isDoctor = t.speaker === "doctor";
                return (
                  <div key={i} className={`flex ${isDoctor ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        isDoctor ? "bg-white text-[var(--color-text-main)]" : "text-white"
                      }`}
                      style={isDoctor ? undefined : { background: "var(--color-primary)" }}
                    >
                      <span
                        className={`mb-0.5 block text-[10px] font-semibold uppercase tracking-wide ${
                          isDoctor ? "text-[var(--color-primary)]" : "text-white/80"
                        }`}
                      >
                        {t.name}
                      </span>
                      {t.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons outside cards */}
      <div className="mt-4 flex items-center justify-end">
        {onForward && (
          <button
            onClick={onForward}
            disabled={submitting || !raw}
            className="btn-primary flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
