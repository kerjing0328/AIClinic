"use client";

import { useEffect } from "react";

interface ModalShellProps {
  children: React.ReactNode;
  onClose?: () => void;
  label: string;
}

export default function ModalShell({ children, onClose, label }: ModalShellProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="glass relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-8 sm:p-10"
        style={{ borderRadius: "var(--radius-panel)", animation: "var(--animate-fade-up)" }}
      >
        {children}
      </div>
    </div>
  );
}
