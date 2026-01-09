import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0f",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(6, 182, 212, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168, 85, 247, 0.15) 0%, transparent 50%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: "linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(168, 85, 247, 0.3))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 24,
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#grad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              background: "linear-gradient(135deg, #06b6d4, #a855f7)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            MCP Hub
          </span>
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          The registry for Model Context Protocol servers
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            marginTop: 48,
            fontSize: 24,
            color: "#71717a",
          }}
        >
          <span>8,000+ Servers</span>
          <span style={{ color: "#06b6d4" }}>•</span>
          <span>AI Integrations</span>
          <span style={{ color: "#a855f7" }}>•</span>
          <span>Open Source</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
