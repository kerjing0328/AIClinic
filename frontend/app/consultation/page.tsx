"use client";

import { useSession } from "@/lib/session";
import SignIn from "@/components/consultation/SignIn";
import ConsultationDashboard from "@/components/consultation/ConsultationDashboard";

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
  return <ConsultationDashboard doctorId={doctorId} />;
}
