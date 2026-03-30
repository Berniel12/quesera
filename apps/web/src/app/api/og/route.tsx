import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

// Category colors matching DESIGN.md
const CAT_COLORS: Record<string, { bg: string; accent: string }> = {
  macro:       { bg: "#1e3a5f", accent: "#60a5fa" },
  crypto:      { bg: "#4a3728", accent: "#f59e0b" },
  politics:    { bg: "#2d2463", accent: "#818cf8" },
  geopolitics: { bg: "#4a1c1c", accent: "#f87171" },
  sports:      { bg: "#1a3a2a", accent: "#34d399" },
  tech:        { bg: "#2d1f4e", accent: "#a78bfa" },
  entertainment: { bg: "#3d1f3d", accent: "#f472b6" },
  disasters:   { bg: "#3d2b1a", accent: "#fb923c" },
};
const DEFAULT_COLORS = { bg: "#0B1326", accent: "#00DAF3" };

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const question = searchParams.get("q") ?? "What happens next?";
  const verdict = searchParams.get("v") ?? "";
  const number = searchParams.get("n") ?? "";
  const category = searchParams.get("c") ?? "";
  const leader = searchParams.get("l") ?? "";

  const colors = CAT_COLORS[category] ?? DEFAULT_COLORS;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          background: `linear-gradient(135deg, ${colors.bg} 0%, #0B1326 100%)`,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: category + brand */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
              color: colors.accent,
            }}
          >
            {category || "QUESERA"}
          </span>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(219, 226, 253, 0.5)",
            }}
          >
            QUESERA
          </span>
        </div>

        {/* Middle: question + number */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1, justifyContent: "center" }}>
          <h1
            style={{
              fontSize: question.length > 50 ? "42px" : "52px",
              fontWeight: 800,
              color: "#DBE2FD",
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {question}
          </h1>

          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            {number && (
              <span
                style={{
                  fontSize: "72px",
                  fontWeight: 900,
                  color: colors.accent,
                  lineHeight: 1,
                }}
              >
                {number}
              </span>
            )}
            {leader && (
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  color: "#DBE2FD",
                  lineHeight: 1,
                }}
              >
                {leader}
              </span>
            )}
          </div>
        </div>

        {/* Bottom: verdict */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {verdict && (
            <span
              style={{
                fontSize: "22px",
                fontWeight: 600,
                color: "rgba(219, 226, 253, 0.7)",
              }}
            >
              {verdict}
            </span>
          )}
          <span
            style={{
              fontSize: "16px",
              color: "rgba(219, 226, 253, 0.3)",
              marginLeft: "auto",
            }}
          >
            Live prediction signals
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
