"use client";

import { useState } from "react";
import Link from "next/link";
import type { Patient } from "@/lib/api";
import RegisterPatientModal from "@/components/patients/RegisterPatientModal";

export default function Home() {
  const [isOpen, setIsOpen] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  return (
    <>
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="label mb-6" style={{ animation: "var(--animate-fade-up)" }}>
          AI Clinical Assistant
        </p>
        <h1
          className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
          style={{ animation: "var(--animate-fade-up)", animationDelay: "0.05s" }}
        >
          Capture every consultation in{" "}
          <span className="text-[var(--color-primary)]">seconds</span>.
        </h1>
        <p
          className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-text-muted)]"
          style={{ animation: "var(--animate-fade-up)", animationDelay: "0.1s" }}
        >
          Let doctors talk to patients. AI handles the documentation.
        </p>

        <div
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          style={{ animation: "var(--animate-fade-up)", animationDelay: "0.15s" }}
        >
          <button
            onClick={() => { setPatient(null); setIsOpen(true); }}
            className="btn-primary rounded-full px-9 py-4 text-sm font-semibold uppercase"
          >
            Register Patient
          </button>
          <Link
            href="/consultation"
            className="btn-ghost rounded-full px-9 py-4 text-sm font-semibold uppercase"
          >
            Start Consultation
          </Link>
        </div>
      </section>

      <footer className="pb-8 text-center">
        <span className="label">Notedr. · v1.0.0</span>
      </footer>

      <RegisterPatientModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onRegistered={(p) => setPatient(p)}
      />
    </>
  );
}
