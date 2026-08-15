"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getMedicalReferences,
  type MedicalReferenceDocument,
} from "@/lib/api";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MedicalReferencesList() {
  const [documents, setDocuments] = useState<MedicalReferenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getMedicalReferences();
      setDocuments(res.documents ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleUploadClick() {
    setUploading(true);
    // Placeholder: in the future this will trigger smart embedding
    setTimeout(() => {
      setUploading(false);
      alert("Smart embedding coming soon! This will process and index the uploaded PDF.");
    }, 1000);
  }

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Medical Reference Documents
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            PDF documents used for AI-powered clinical review and evidence retrieval.
          </p>
        </div>
        <button
          onClick={handleUploadClick}
          disabled={uploading}
          className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase disabled:opacity-50"
        >
          {uploading ? (
            <span className="spinner" aria-hidden />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          {uploading ? "Processing…" : "Upload & Embed"}
        </button>
      </div>

      {/* Document list */}
      <div className="glass rounded-3xl border border-[var(--border-glass)] p-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="spinner spinner-dark" aria-hidden />
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Loading documents…
            </p>
          </div>
        )}

        {error && !loading && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[var(--color-text-muted)]"
              aria-hidden
            >
              <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="14,2 14,8 20,8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-[var(--color-text-main)]">
              No documents found
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Upload PDF files to data/medical_references/ to get started.
            </p>
          </div>
        )}

        {!loading && !error && documents.length > 0 && (
          <>
            <p className="mb-4 text-xs text-[var(--color-text-muted)]">
              {documents.length} document{documents.length !== 1 ? "s" : ""} found
            </p>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.name}
                  className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/50 px-5 py-4 transition hover:bg-white/70"
                >
                  {/* PDF icon */}
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--color-primary-light)" }}
                    aria-hidden
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                        stroke="var(--color-primary)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="14,2 14,8 20,8"
                        stroke="var(--color-primary)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 15h6M9 11h6M9 19h3"
                        stroke="var(--color-primary)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text-main)]">
                      {doc.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {formatFileSize(doc.size_bytes)} · Added {formatDate(doc.modified_at)}
                    </p>
                  </div>

                  {/* Badge */}
                  <span className="shrink-0 rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                    PDF
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Hidden file input for future upload */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={() => {/* placeholder */}}
      />
    </div>
  );
}
