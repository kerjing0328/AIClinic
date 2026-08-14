"use client";

// lib/session.tsx
// Minimal doctor session: stores the signed-in doctor in localStorage
// and exposes it via React context so any page can read doctor_id.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doctorKey, type Doctor } from "@/lib/api";

const STORAGE_KEY = "clinic.doctor";

interface SessionValue {
  doctor: Doctor | null;
  doctorId: string | null;
  signIn: (doctor: Doctor) => void;
  signOut: () => void;
  ready: boolean; // hydration finished
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDoctor(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function signIn(d: Doctor) {
    setDoctor(d);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }

  function signOut() {
    setDoctor(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const doctorId = doctor ? String(doctorKey(doctor)) : null;

  return (
    <SessionContext.Provider value={{ doctor, doctorId, signIn, signOut, ready }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
