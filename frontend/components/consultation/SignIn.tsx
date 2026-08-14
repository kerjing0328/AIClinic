"use client";

import { useState } from "react";
import { signinDoctor } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function SignIn() {
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
