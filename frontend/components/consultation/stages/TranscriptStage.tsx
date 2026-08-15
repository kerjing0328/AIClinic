"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setTranscribed, consultationKey, transcribeAudio, type Consultation } from "@/lib/api";
import { parseTranscript, parseLine, type Turn } from "@/lib/transcript";

type Tab = "text" | "audio";

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
  /* ---- tab state ---- */
  const [activeTab, setActiveTab] = useState<Tab>("text");

  /* ---- shared transcript state ---- */
  const [raw, setRaw] = useState(initialTranscript ?? "");
  const [fileName, setFileName] = useState(initialTranscript ? "transcript.txt" : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- audio-specific state ---- */
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string>("");
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionLines, setTranscriptionLines] = useState<string[]>([]);
  const [transcriptionDone, setTranscriptionDone] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ---- parsed turns (works for both text and audio modes) ---- */
  const turns: Turn[] = useMemo(() => {
    if (activeTab === "audio" && transcriptionLines.length > 0) {
      return transcriptionLines.map((l) => parseLine(l)).filter((t): t is Turn => t !== null);
    }
    return raw ? parseTranscript(raw) : [];
  }, [raw, activeTab, transcriptionLines]);

  /* ---- auto-scroll chat to bottom ---- */
  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length]);

  /* ---- cleanup object URL on unmount ---- */
  useEffect(() => {
    return () => {
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    };
  }, [audioObjectUrl]);

  /* ================================================================
     TEXT TAB — file upload handler (existing behaviour)
     ================================================================ */
  async function handleTextFile(e: React.ChangeEvent<HTMLInputElement>) {
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

  /* ================================================================
     AUDIO TAB — file pick handler (auto-starts transcription)
     ================================================================ */
  const handleAudioFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset previous state
      setError("");
      setRaw("");
      setTranscriptionLines([]);
      setTranscriptionDone(false);
      setFileName(file.name);
      setAudioFile(file);

      // Revise previous object URL
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
      setAudioObjectUrl(URL.createObjectURL(file));

      // Auto-start transcription
      startTranscription(file);
    },
    [audioObjectUrl],
  );

  /* ================================================================
     AUDIO TAB — start transcription (SSE stream)
     ================================================================ */
  async function startTranscription(file: File) {
    setTranscribing(true);
    setError("");
    setTranscriptionLines([]);

    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;

    try {
      const res = await transcribeAudio(consultationKey(consultation), file);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          try {
            const evt = JSON.parse(payload);
            if (evt.error) {
              setError(evt.error);
              setTranscribing(false);
              return;
            }
            if (evt.line) {
              setTranscriptionLines((prev) => [...prev, evt.line]);
            }
            if (evt.done) {
              setTranscriptionDone(true);
              setTranscribing(false);
              // Advance raw so the Next button enables
              setRaw(evt.transcript ?? "");
            }
          } catch {
            // ignore malformed events
          }
        }
      }

      // If stream ended without a "done" event
      setTranscribing(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Transcription failed.");
      setTranscribing(false);
    }
  }

  /* ================================================================
     AUDIO TAB — stop transcription
     ================================================================ */
  function handleStopTranscription() {
    abortRef.current?.abort();
    setTranscribing(false);
  }

  /* ================================================================
     CONFIRM — save transcript and advance (shared by both tabs)
     ================================================================ */
  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const transcriptRaw = activeTab === "audio" ? transcriptionLines.join("\n") : raw;
      const path = fileName || `consultation_${consultationKey(consultation)}.txt`;
      const res = await setTranscribed(consultationKey(consultation), path, transcriptRaw);
      onTranscribed(res.consultation, transcriptRaw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach transcript.");
      setSubmitting(false);
    }
  }

  /* ================================================================
     Can the user advance?
     ================================================================ */
  const canConfirm =
    activeTab === "text" ? !!raw : transcriptionDone && transcriptionLines.length > 0;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* ============================================================ */}
        {/* LEFT — upload card                                           */}
        {/* ============================================================ */}
        <div
          className="glass flex flex-col p-8 sm:p-10"
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          {/* ---- Tab bar ---- */}
          <div className="flex gap-2 rounded-full bg-white/50 p-1">
            {([["text", "Upload Text"], ["audio", "Upload Audio"]] as const).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key);
                    setError("");
                  }}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === key
                      ? "bg-[var(--color-primary)] text-white shadow"
                      : "text-[var(--color-text-muted)] hover:bg-white/60"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {/* ================================================================ */}
          {/* TAB: TEXT                                                       */}
          {/* ================================================================ */}
          {activeTab === "text" && (
            <>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                Upload transcript
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Upload the recorded consultation transcript (.txt). It will appear
                as a conversation on the right for you to confirm.
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
                  onChange={handleTextFile}
                />
                <div className="flex h-full flex-col items-center justify-center">
                  <span
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                    }}
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
                    Format: lines like &quot;Doctor: …&quot; and &quot;Patient: …&quot;
                  </p>
                </div>
              </div>

              {fileName && !transcribing && (
                <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-primary)]">
                  <span aria-hidden>✓</span> {turns.length} lines parsed from{" "}
                  <span className="font-medium">{fileName}</span>
                </p>
              )}
            </>
          )}

          {/* ================================================================ */}
          {/* TAB: AUDIO                                                      */}
          {/* ================================================================ */}
          {activeTab === "audio" && (
            <>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                Upload audio
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Upload a recorded consultation audio file. The AI will transcribe
                it in real-time and display the conversation on the right.
              </p>

              {/* ---- File picker / audio player ---- */}
              {!audioObjectUrl ? (
                <div
                  className="mt-7 flex-1 cursor-pointer rounded-3xl border-2 border-dashed border-white/80 bg-white/40 p-8 text-center transition hover:bg-white/60"
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac"
                    className="hidden"
                    onChange={handleAudioFile}
                  />
                  <div className="flex h-full flex-col items-center justify-center">
                    <span
                      className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        background: "var(--color-primary-light)",
                        color: "var(--color-primary)",
                      }}
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
                      Click to upload audio
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Formats: MP3, WAV, M4A, OGG, WebM, FLAC
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-7 flex-1 rounded-3xl bg-white/40 p-5">
                  {/* Audio player */}
                  <audio
                    ref={audioRef}
                    src={audioObjectUrl}
                    controls
                    className="w-full"
                  />

                  {/* File info + change button */}
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-main)] truncate max-w-[70%]">
                      {audioFile?.name}
                    </p>
                    <button
                      onClick={() => {
                        setAudioFile(null);
                        setAudioObjectUrl("");
                        setTranscriptionLines([]);
                        setTranscriptionDone(false);
                        setFileName("");
                        setRaw("");
                      }}
                      className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text-main)]"
                    >
                      Change file
                    </button>
                  </div>

                  {/* Transcription status / Stop button */}
                  <div className="mt-4">
                    {transcribing ? (
                      <button
                        onClick={handleStopTranscription}
                        className="btn-danger flex w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold uppercase"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
                        </svg>
                        Stop Transcription
                      </button>
                    ) : transcriptionDone ? (
                      <div className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-primary-light)] px-8 py-3.5 text-sm font-semibold uppercase text-[var(--color-primary)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Transcription Complete
                      </div>
                    ) : null}
                  </div>

                  {/* Progress indicator */}
                  {transcriptionLines.length > 0 && (
                    <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
                      {transcriptionLines.length} line
                      {transcriptionLines.length !== 1 ? "s" : ""} transcribed
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ---- Shared: error ---- */}
          {error && (
            <p
              className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* ---- Shared: Confirm button ---- */}
          <div className="mt-8">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
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

        {/* ============================================================ */}
        {/* RIGHT — conversation bubbles (shared)                        */}
        {/* ============================================================ */}
        <div
          className="glass flex flex-col p-8 sm:p-10"
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Conversation</h3>
            {turns.length > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                }}
              >
                {turns.length} lines
              </span>
            )}
          </div>

          <div
            ref={chatContainerRef}
            className="mt-5 flex-1 space-y-3 overflow-y-auto rounded-3xl bg-white/40 p-5"
            style={{ maxHeight: "32rem", minHeight: "18rem" }}
          >
            {turns.length === 0 ? (
              transcribing ? (
                <div className="flex h-full min-h-[16rem] flex-col items-center justify-center text-center text-sm text-[var(--color-text-muted)]">
                  <span className="spinner spinner-dark mb-3" />
                  <p className="font-medium text-[var(--color-text-main)]">
                    Transcribing audio…
                  </p>
                  <p className="mt-1 text-xs">
                    Waiting for the AI to process the recording.
                    <br />
                    Lines will appear here as they are transcribed.
                  </p>
                </div>
              ) : (
                <div className="flex h-full min-h-[16rem] flex-col items-center justify-center text-center text-sm text-[var(--color-text-muted)]">
                  <span className="mb-2 text-2xl" aria-hidden>
                    💬
                  </span>
                  No transcript loaded yet.
                  <br />
                  {activeTab === "text"
                    ? "Upload a file to preview the conversation here."
                    : "Upload an audio file to preview the conversation here."}
                </div>
              )
            ) : (
              turns.map((t, i) => {
                const isDoctor = t.speaker === "doctor";
                return (
                  <div
                    key={i}
                    className={`flex ${isDoctor ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        isDoctor
                          ? "bg-white text-[var(--color-text-main)]"
                          : "text-white"
                      }`}
                      style={
                        isDoctor ? undefined : { background: "var(--color-primary)" }
                      }
                    >
                      <span
                        className={`mb-0.5 block text-[10px] font-semibold uppercase tracking-wide ${
                          isDoctor
                            ? "text-[var(--color-primary)]"
                            : "text-white/80"
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

            {/* Live indicator while streaming */}
            {transcribing && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-white px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                    AI
                  </span>
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
                      ●
                    </span>
                    <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
                      ●
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Navigation buttons ---- */}
      <div className="mt-4 flex items-center justify-end">
        {onForward && (
          <button
            onClick={onForward}
            disabled={submitting || !canConfirm}
            className="btn-primary flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
          >
            Next
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
