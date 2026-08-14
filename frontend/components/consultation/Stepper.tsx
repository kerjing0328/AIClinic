"use client";

import type { Stage } from "@/lib/consultation-utils";

const STEPS: { key: Stage; label: string }[] = [
  { key: "select", label: "Patient" },
  { key: "transcript", label: "Transcript" },
  { key: "extract", label: "AI Extraction" },
  { key: "review", label: "Review" },
  { key: "report", label: "Approved" },
];

export default function Stepper({ stage }: { stage: Stage }) {
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
