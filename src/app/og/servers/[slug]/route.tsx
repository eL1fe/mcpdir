import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getServerOgBySlug } from "@/lib/db/queries";
import { CACHE_CONTROL } from "@/lib/cache";

export const runtime = "nodejs";
export const revalidate = 604800;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const server = await getServerOgBySlug(slug);

  if (!server) {
    return new Response("Not found", { status: 404 });
  }

  const tools = (server.tools as { name: string }[]) || [];
  const toolCount = tools.length;
  const stars = server.starsCount || 0;
  const description = server.description?.slice(0, 140) || "MCP server for AI integrations";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          backgroundColor: "#0a0a0f",
          backgroundImage: "radial-gradient(circle at 0% 0%, rgba(6, 182, 212, 0.12) 0%, transparent 50%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
          <span
            style={{
              fontSize: 20,
              color: "#a1a1aa",
              background: "rgba(6, 182, 212, 0.15)",
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(6, 182, 212, 0.25)",
            }}
          >
            MCP Server
          </span>
          {server.validationStatus === "validated" && (
            <span
              style={{
                fontSize: 20,
                color: "#22c55e",
                background: "rgba(34, 197, 94, 0.15)",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid rgba(34, 197, 94, 0.25)",
                marginLeft: 12,
              }}
            >
              Verified
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            background: "linear-gradient(135deg, #06b6d4, #a855f7)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 24,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          {server.name}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#a1a1aa",
            lineHeight: 1.4,
            maxWidth: 900,
            marginBottom: "auto",
          }}
        >
          {description}
          {(server.description?.length || 0) > 140 ? "..." : ""}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            marginTop: 40,
          }}
        >
          {stars > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#fbbf24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span style={{ fontSize: 28, color: "#fbbf24", fontWeight: 600 }}>
                {stars.toLocaleString()}
              </span>
            </div>
          )}
          {toolCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span style={{ fontSize: 28, color: "#06b6d4", fontWeight: 600 }}>
                {toolCount} tool{toolCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 40,
            paddingTop: 24,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(168, 85, 247, 0.3))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="url(#grad2)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span style={{ fontSize: 24, color: "#71717a" }}>mcpdir.dev</span>
          </div>
          <span style={{ fontSize: 20, color: "#52525b" }}>mcpdir.dev/servers/{slug}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": CACHE_CONTROL.week },
    }
  );
}
