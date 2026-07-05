"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, background: "#0b0910", color: "#fff", fontFamily: "system-ui", display: "grid", minHeight: "100vh", placeItems: "center", padding: 24 }}>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p style={{ color: "#d8cbd4" }}>
            It's been logged. Refresh to carry on{error.digest ? ` (ref ${error.digest})` : ""}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, background: "#db2777", color: "#fff", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
