"use client";

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function checkBackend() {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("http://localhost:8000/health");

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      const data = await response.json();

      setStatus(data.status);
    } catch (error) {
      console.error(error);
      setStatus("Backend connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>AI Clinical Assistant</h1>

      <button onClick={checkBackend}>
        {loading ? "Checking..." : "Check Backend"}
      </button>

      {status && (
        <p>
          Backend status: {status}
        </p>
      )}
    </main>
  );
}