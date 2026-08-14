"use client";

import { useEffect, useState } from "react";
import { getPatient, type Consultation } from "@/lib/api";
import type { Stage } from "@/lib/consultation-utils";
import StageContainer from "./StageContainer";
import Stepper from "./Stepper";
import SelectPatientStage from "./stages/SelectPatientStage";
import TranscriptStage from "./stages/TranscriptStage";
import ExtractStage from "./stages/ExtractStage";
import ReviewStage from "./stages/ReviewStage";
import ReportStage from "./stages/ReportStage";

const STAGE_ORDER: Stage[] = ["select", "transcript", "extract", "review", "report"];
function stageRank(s: Stage): number {
  return STAGE_ORDER.indexOf(s);
}

interface PatientInfo {
  name: string;
  patient_ic: string;
  age?: number;
  gender?: string;
}

interface ConsultationFlowProps {
  doctorId: string;
  initialConsultation?: Consultation | null;
  initialStage?: Stage;
  initialPatientInfo?: PatientInfo | null;
  onBack?: () => void;
}

export default function ConsultationFlow({
  doctorId,
  initialConsultation,
  initialStage,
  initialPatientInfo,
  onBack,
}: ConsultationFlowProps) {
  const [stage, setStage] = useState<Stage>(initialStage ?? "select");
  const [consultation, setConsultation] = useState<Consultation | null>(
    initialConsultation ?? null
  );
  const [transcript, setTranscript] = useState<string>(
    (initialConsultation?.transcript_content as string) ?? ""
  );
  const [furthestStage, setFurthestStage] = useState<Stage>(initialStage ?? "select");
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(initialPatientInfo ?? null);

  // Fetch patient details when resuming (if not provided)
  useEffect(() => {
    if (initialConsultation && !initialPatientInfo && initialConsultation.patient_id) {
      getPatient(initialConsultation.patient_id)
        .then((res) => {
          setPatientInfo({
            name: res.patient.name ?? "Unknown Patient",
            patient_ic: res.patient.patient_ic ?? "",
            age: res.patient.age,
            gender: res.patient.gender,
          });
        })
        .catch(() => {
          // Silently fail - banner will show without patient details
        });
    }
  }, [initialConsultation, initialPatientInfo]);

  function advanceTo(target: Stage) {
    if (stageRank(target) > stageRank(furthestStage)) {
      setFurthestStage(target);
    }
    setStage(target);
  }

  function resetAll() {
    setStage("select");
    setConsultation(null);
    setTranscript("");
    setFurthestStage("select");
  }

  function goBack() {
    const prev: Record<string, Stage> = {
      transcript: "select",
      extract: "transcript",
      review: "extract",
      report: "review",
    };
    const target = prev[stage];
    if (target && !(target === "select" && consultation)) {
      setStage(target);
    }
  }

  function goForward() {
    const next: Record<string, Stage> = {
      select: "transcript",
      transcript: "extract",
      extract: "review",
      review: "report",
    };
    const target = next[stage];
    if (target && stageRank(target) <= stageRank(furthestStage)) {
      setStage(target);
    }
  }

  const canForward =
    stage !== "report" &&
    stageRank(stage) < stageRank(furthestStage);

  return (
    <section className="flex-1 py-14">
      <StageContainer width="wide">
        <div style={{ animation: "var(--animate-fade-up)" }}>
          {onBack && (
            <button
              onClick={onBack}
              className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text-main)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to consultations
            </button>
          )}
          <p className="label">Consultation</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            {consultation ? "Continue Consultation" : "New Consultation"}
          </h1>
          <Stepper stage={stage} />

          {patientInfo && consultation && (
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-white/50 px-5 py-3.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--color-text-main)]">{patientInfo.name}</span>
              </div>
              {patientInfo.patient_ic && (
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <span className="font-medium">IC:</span> {patientInfo.patient_ic}
                </div>
              )}
              {patientInfo.age !== undefined && (
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <span className="font-medium">Age:</span> {patientInfo.age}
                </div>
              )}
              {patientInfo.gender && (
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <span className="font-medium">Gender:</span> {patientInfo.gender}
                </div>
              )}
            </div>
          )}
        </div>
      </StageContainer>

      <div className="mt-10" style={{ animation: "var(--animate-fade-up)", animationDelay: "0.05s" }}>
        {stage === "select" && (
          <StageContainer>
            <SelectPatientStage
              doctorId={doctorId}
              initialPatientId={
                consultation
                  ? String(consultation.patient_id)
                  : undefined
              }
              onCreated={(c, patient) => {
                setConsultation(c);
                setPatientInfo(patient);
                advanceTo("transcript");
              }}
            />
          </StageContainer>
        )}

        {stage === "transcript" && consultation && (
          <StageContainer width="wide">
            <TranscriptStage
              consultation={consultation}
              initialTranscript={transcript}
              onBack={goBack}
              onForward={canForward ? goForward : undefined}
              onTranscribed={(c, raw) => {
                setConsultation(c);
                setTranscript(raw);
                advanceTo("extract");
              }}
            />
          </StageContainer>
        )}

        {stage === "extract" && consultation && (
          <StageContainer>
            <ExtractStage
              consultation={consultation}
              transcript={transcript}
              onBack={goBack}
              onForward={canForward ? goForward : undefined}
              onExtracted={(c) => {
                setConsultation(c);
                advanceTo("review");
              }}
            />
          </StageContainer>
        )}

        {stage === "review" && consultation && (
          <StageContainer width="wide">
            <ReviewStage
              consultation={consultation}
              onBack={goBack}
              onForward={canForward ? goForward : undefined}
              onApproved={(c) => {
                setConsultation(c);
                advanceTo("report");
              }}
            />
          </StageContainer>
        )}

        {stage === "report" && consultation && (
          <StageContainer width="wide">
            <ReportStage consultation={consultation} onBack={goBack} onNew={resetAll} />
          </StageContainer>
        )}
      </div>
    </section>
  );
}
