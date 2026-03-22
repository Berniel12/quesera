"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Inter, sans-serif", backgroundColor: "#FAF9F6", color: "#0B1326", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Something went wrong</h2>
          <button onClick={reset} style={{ backgroundColor: "#0B1326", color: "#FAF9F6", border: "none", borderRadius: "999px", padding: "0.75rem 2rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
