"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ maxWidth: "32rem", margin: "5rem auto", textAlign: "center", padding: "1.5rem" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0B1326", marginBottom: "1rem" }}>Something went wrong</h2>
      <button onClick={reset} style={{ backgroundColor: "#0B1326", color: "#FAF9F6", border: "none", borderRadius: "999px", padding: "0.75rem 2rem", fontSize: "0.875rem", cursor: "pointer" }}>Try Again</button>
    </div>
  );
}
