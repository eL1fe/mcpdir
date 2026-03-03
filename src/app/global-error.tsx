"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ textAlign: "center", maxWidth: "28rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Something went wrong</h2>
            <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>
              A critical error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.5rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(0, 200, 200, 0.3)",
                background: "rgba(0, 200, 200, 0.1)",
                color: "#00c8c8",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
