"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPatients,
  signinDoctor,
  createConsultation,
  setTranscribed,
  setAiExtracted,
  getAiExtracted,
  setDoctorApproved,
  consultationKey,
  patientKey,
  type Patient,
  type Consultation,
} from "@/lib/api";
import { parseTranscript, type Turn } from "@/lib/transcript";
import { useSession } from "@/lib/session";
import { downloadConsultationReport } from "@/lib/api";

type Stage = "select" | "transcript" | "extract" | "review" | "report";

export default function ConsultationPage() {
  const { doctor, doctorId, ready } = useSession();

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-[var(--color-text-muted)]">
        <span className="spinner spinner-dark mr-3" aria-hidden />
        Loading…
      </div>
    );
  }

  if (!doctor || !doctorId) return <SignIn />;
  return <ConsultationFlow doctorId={doctorId} />;
}

/* ============================================================
   Layout helper — centers stage content, full width w/ padding
   ============================================================ */
function StageContainer({
  children,
  width = "narrow",
}: {
  children: React.ReactNode;
  width?: "narrow" | "wide";
}) {
  const max = width === "wide" ? "max-w-7xl" : "max-w-2xl";
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className={`mx-auto w-full ${max}`}>{children}</div>
    </div>
  );
}

/* ============================================================
   Doctor sign-in
   ============================================================ */
function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await signinDoctor(email.trim());
      signIn(res.doctor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-1 items-center justify-center px-4 py-20 sm:px-6">
      <div
        className="glass w-full max-w-md p-8 sm:p-10"
        style={{ borderRadius: "var(--radius-panel)", animation: "var(--animate-fade-up)" }}
      >
        <p className="label">Doctor Portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Enter your registered email to start a consultation session.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label mb-2 block">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. dr.aisyah@clinic.my"
              className="field w-full rounded-2xl px-5 py-3.5 text-[var(--color-text-main)] disabled:opacity-60"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </section>
  );
}

/* ============================================================
   Consultation flow (stage machine)
   ============================================================ */
function ConsultationFlow({ doctorId }: { doctorId: string }) {
  const [stage, setStage] = useState<Stage>("select");
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  function resetAll() {
    setStage("select");
    setConsultation(null);
    setTranscript("");
  }

  return (
    <section className="flex-1 py-14">
      <StageContainer width="wide">
        <div style={{ animation: "var(--animate-fade-up)" }}>
          <p className="label">Consultation</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            New Consultation
          </h1>
          <Stepper stage={stage} />
        </div>
      </StageContainer>

      <div className="mt-10" style={{ animation: "var(--animate-fade-up)", animationDelay: "0.05s" }}>
        {stage === "select" && (
          <StageContainer>
            <SelectPatientStage
              doctorId={doctorId}
              onCreated={(c) => {
                setConsultation(c);
                setStage("transcript");
              }}
            />
          </StageContainer>
        )}

        {stage === "transcript" && consultation && (
          <StageContainer width="wide">
            <TranscriptStage
              consultation={consultation}
              onTranscribed={(c, raw) => {
                setConsultation(c);
                setTranscript(raw);
                setStage("extract");
              }}
            />
          </StageContainer>
        )}

        {stage === "extract" && consultation && (
          <StageContainer>
            <ExtractStage
              consultation={consultation}
              transcript={transcript}
              onExtracted={(c) => {
                setConsultation(c);
                setStage("review");
              }}
            />
          </StageContainer>
        )}

        {stage === "review" && consultation && (
          <StageContainer width="wide">
            <ReviewStage
              consultation={consultation}
              onApproved={(c) => {
                setConsultation(c);
                setStage("report");
              }}
            />
          </StageContainer>
        )}

        {stage === "report" && consultation && (
          <StageContainer width="wide">
            <ReportStage consultation={consultation} onNew={resetAll} />
          </StageContainer>
        )}
      </div>
    </section>
  );
}

/* ============================================================
   Stepper
   ============================================================ */
const STEPS: { key: Stage; label: string }[] = [
  { key: "select", label: "Patient" },
  { key: "transcript", label: "Transcript" },
  { key: "extract", label: "AI Extraction" },
  { key: "review", label: "Review" },
  { key: "report", label: "Approved" },
];

function Stepper({ stage }: { stage: Stage }) {
  const currentIndex = STEPS.findIndex((s) => s.key === stage);
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      {STEPS.map((s, i) => {
        const report = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.key} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                report
                  ? "bg-[var(--color-primary)] text-white"
                  : active
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]"
                  : "bg-white/60 text-[var(--color-text-muted)]"
              }`}
            >
              {report ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm ${
                active
                  ? "font-semibold text-[var(--color-text-main)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="hidden h-px w-8 bg-white/70 sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   STAGE 1 — Select patient → create draft
   ============================================================ */
function SelectPatientStage({
  doctorId,
  onCreated,
}: {
  doctorId: string;
  onCreated: (c: Consultation) => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getPatients();
        setPatients(res?.patients ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load patients.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await createConsultation(selectedId, doctorId);
      onCreated(res.consultation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create consultation.");
      setSubmitting(false);
    }
  }

  const selected = patients.find((p) => String(patientKey(p)) === selectedId);

  return (
    <div className="glass w-full p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
      <h2 className="text-2xl font-semibold tracking-tight">Select a patient</h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Choose a registered patient to begin the consultation.
      </p>

      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-[var(--color-text-muted)]">
          <span className="spinner spinner-dark" aria-hidden />
          Loading patients…
        </div>
      ) : (
        <>
          <div className="mt-8">
            <label htmlFor="patient" className="label mb-2 block">
              Patient
            </label>
            <select
              id="patient"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={submitting}
              className="field w-full rounded-2xl px-5 py-3.5 text-[var(--color-text-main)] disabled:opacity-60"
            >
              <option value="">— Select a patient —</option>
              {patients.map((p) => (
                <option key={String(patientKey(p))} value={String(patientKey(p))}>
                  {p.name} · {p.patient_ic}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="mt-5 rounded-2xl bg-white/50 p-5">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                {selected.age !== undefined && <Detail label="Age" value={String(selected.age)} />}
                {selected.gender && <Detail label="Gender" value={String(selected.gender)} />}
                {selected.phone && <Detail label="Phone" value={String(selected.phone)} />}
                {selected.patient_ic && <Detail label="IC" value={String(selected.patient_ic)} />}
              </dl>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div className="mt-8">
            <button
              onClick={handleConfirm}
              disabled={!selectedId || submitting}
              className="btn-primary flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold uppercase disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="spinner" aria-hidden />
                  Creating…
                </>
              ) : (
                "Confirm & Start"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   STAGE 2 — Two columns: upload (left) | transcript loaded (right)
   ============================================================ */
function TranscriptStage({
  consultation,
  onTranscribed,
}: {
  consultation: Consultation;
  onTranscribed: (c: Consultation, raw: string) => void;
}) {
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
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
      const res = await setTranscribed(consultationKey(consultation), path);
      onTranscribed(res.consultation, raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach transcript.");
      setSubmitting(false);
    }
  }

  return (
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
              Format: lines like “Doctor: …” and “Patient: …”
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
              <span className="mb-2 text-2xl" aria-hidden>💬</span>
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
  );
}

/* ============================================================
   STAGE 3 — AI extraction (progress) → editable forms
   ============================================================ */
function ExtractStage({
  consultation,
  onExtracted,
}: {
  consultation: Consultation;
  transcript: string;
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

  return (
    <div className="glass w-full p-8 sm:p-10" style={{ borderRadius: "var(--radius-panel)" }}>
      <h2 className="text-2xl font-semibold tracking-tight">AI extraction</h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        The AI will read the transcript and extract structured clinical data.
      </p>

      {!running ? (
        <>
          <div className="mt-7 rounded-2xl bg-white/50 p-5 text-sm text-[var(--color-text-muted)]">
            Transcript attached ✓ — ready to extract. This typically takes about
            <span className="font-semibold text-[var(--color-text-main)]"> 3 minutes</span>.
          </div>
          {error && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="mt-8">
            <button
              onClick={startExtraction}
              className="btn-primary rounded-full px-8 py-3.5 text-sm font-semibold uppercase"
            >
              Start AI Extraction
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
            Expected ~3 minutes. Please wait — do not close this window.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STAGE 4 — Review (recursive grouping mirrors JSON) + red flags
   ============================================================ */

/** Mandatory leaf fields — empty values raise a red flag & block approval. */
const MANDATORY_FIELDS = [
  "allergies",
  "allergy",
  "vital_signs",
  "vitals",
  "medical_history",
  "history",
  "symptoms",
  "duration",
  "chief_complaint",
  "diagnosis",
];

function lastSeg(key: string) {
  const parts = key.split(".");
  return parts[parts.length - 1];
}

function isMandatory(fullKey: string) {
  const k = fullKey.toLowerCase();
  const leaf = lastSeg(fullKey).toLowerCase();
  return MANDATORY_FIELDS.some((m) => leaf.includes(m) || k.includes(m));
}

/** Clinical ordering for group + field segments. */
const ORDER = [
  "chief_complaint",
  "type",
  "age",
  "gender",
  "demographics",
  "history",
  "symptoms",
  "duration",
  "onset",
  "severity",
  "examination",
  "vital_signs",
  "findings",
  "assessment",
  "diagnosis",
  "clinical_impression",
  "investigations",
  "plan",
  "medications",
  "treatment",
  "follow_up",
  "safety_netting",
];
function rank(seg: string) {
  const i = ORDER.indexOf(seg.toLowerCase());
  return i === -1 ? ORDER.length + 1 : i;
}

/** Immediate children (leaves + subgroups) of a given prefix in the flat map. */
function childrenOf(fields: Record<string, string>, prefix: string) {
  const base = prefix ? prefix + "." : "";
  const leaves: string[] = [];
  const subgroups = new Set<string>();
  for (const key of Object.keys(fields)) {
    if (!key.startsWith(base)) continue;
    const rest = key.slice(base.length);
    if (!rest) continue;
    const dot = rest.indexOf(".");
    if (dot === -1) leaves.push(key);
    else subgroups.add(base + rest.slice(0, dot));
  }
  leaves.sort((a, b) => rank(lastSeg(a)) - rank(lastSeg(b)));
  const subs = [...subgroups].sort((a, b) => rank(lastSeg(a)) - rank(lastSeg(b)));
  return { leaves, subgroups: subs };
}

/** Count empty-mandatory leaves under a prefix (recursively). */
function flagsUnder(fields: Record<string, string>, prefix: string) {
  const base = prefix ? prefix + "." : "";
  return Object.entries(fields).filter(
    ([key, value]) =>
      (prefix === "" || key.startsWith(base)) &&
      isMandatory(key) &&
      value.trim() === ""
  ).length;
}

function ReviewStage({
  consultation,
  onApproved,
}: {
  consultation: Consultation;
  onApproved: (c: Consultation) => void;
}) {
  const extracted = useMemo<Record<string, unknown>>(() => {
    let src =
      (consultation.ai_extracted as Record<string, unknown>) ??
      (consultation.extracted_data as Record<string, unknown>) ??
      {};
    // Unwrap a single { extracted_data: {...} } wrapper if present.
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
      onApproved(res.consultation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve.");
      setSaving(false);
    }
  }

  /* Render a single editable leaf field. */
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

  /* Recursively render a group (object) and its sub-groups — mirrors JSON. */
  function renderGroup(prefix: string, depth: number): React.ReactNode {
    const { leaves, subgroups } = childrenOf(fields, prefix);

    // ROOT: render top-level scalars under "General", then each subgroup.
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

    // depth 1 → glass sub-panel; depth ≥2 → nested bordered box.
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

      {/* Recursive grouped form */}
      <div className="mt-8">{renderGroup("", 0)}</div>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
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
        {hasRedFlags && (
          <span className="text-sm text-red-600">
            Resolve {redFlags.length} required field{redFlags.length > 1 ? "s" : ""} to continue.
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   FINAL — Read-only report + PDF download
   Replaces DoneStage. Reuses: flatten, childrenOf, lastSeg,
   prettyLabel, consultationKey, downloadConsultationReport.
   ============================================================ */
function ReportStage({
  consultation,
  onNew,
}: {
  consultation: Consultation;
  onNew: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // Prefer the doctor-approved final note; fall back to extracted data.
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

  /* Read-only recursive group renderer (mirrors JSON, no inputs). */
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

  return (
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

        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn-primary flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold uppercase disabled:opacity-60"
          >
            {downloading ? (
              <>
                <span className="spinner" aria-hidden />
                Preparing…
              </>
            ) : (
              <>
                {/* download icon */}
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
          <button
            onClick={onNew}
            className="btn-ghost rounded-full px-7 py-3 text-sm font-semibold uppercase"
          >
            New Consultation
          </button>
        </div>
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
        ) : (
          ReadGroup("", 0)
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--color-text-main)] break-words">{value}</dd>
    </div>
  );
}

function prettyLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyPath(key: string) {
  return key
    .split(".")
    .map((seg) => prettyLabel(seg))
    .join(" › ");
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      out[key] = v.join(", ");
    } else {
      out[key] = v == null ? "" : String(v);
    }
  }
  return out;
}

function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let node = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) {
        node[p] = value;
      } else {
        node[p] = (node[p] as Record<string, unknown>) ?? {};
        node = node[p] as Record<string, unknown>;
      }
    });
  }
  return out;
}

/* Fallback template — mirrors the real nested extraction shape. */
const SAMPLE_EXTRACTED: Record<string, unknown> = {
  chief_complaint: "",
  type: "",
  age: "",
  gender: "",
  history: {
    onset: "",
    duration: "",
    severity: "",
    symptoms: "",
    allergies: "",
    medications: "",
    medical_history: "",
  },
  examination: {
    findings: "",
    vital_signs: {
      blood_pressure: "",
      heart_rate: "",
      temperature: "",
      respiratory_rate: "",
      oxygen_saturation: "",
    },
  },
  assessment: {
    diagnosis: "",
    clinical_impression: "",
  },
  investigations: {
    ordered: "",
    results: "",
  },
  plan: {
    medications: "",
    treatment: "",
    follow_up: "",
    safety_netting: "",
  },
};
