#!/usr/bin/env tsx
import { config } from "dotenv";
import { syncServers, SyncResult } from "./lib/sync";
import { SourceType } from "./lib/sources/base";

config({ path: ".env.local" });

function parseArgs(): {
  sources: SourceType[];
  skipAI: boolean;
  forceRefresh: boolean;
  retryAIFailed: boolean;
  validateNew: boolean;
  limit?: number;
} {
  const args = process.argv.slice(2);

  // Parse --sources=registry,npm,github
  let sources: SourceType[] = ["mcp-registry"];
  const sourcesArg = args.find((a) => a.startsWith("--sources="));
  if (sourcesArg) {
    const value = sourcesArg.split("=")[1];
    if (value === "all") {
      sources = ["mcp-registry", "glama", "npm", "github", "pulsemcp"];
    } else if (value === "fast") {
      // Fast sources only (no pulsemcp which requires cache file)
      sources = ["mcp-registry", "glama", "npm", "github"];
    } else {
      sources = value.split(",").map((s) => s.trim() as SourceType);
    }
  }

  // Parse --limit=N
  let limit: number | undefined;
  const limitArg = args.find((a) => a.startsWith("--limit="));
  if (limitArg) {
    limit = parseInt(limitArg.split("=")[1], 10);
  }

  const hasAI = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENROUTER_API_KEY;
  const skipAI = process.env.SKIP_AI === "true" || !hasAI;
  const forceRefresh = process.env.FORCE_REFRESH === "true" || args.includes("--force");
  const retryAIFailed = process.env.RETRY_AI_FAILED === "true" || args.includes("--retry-ai");
  const validateNew = args.includes("--validate");

  return { sources, skipAI, forceRefresh, retryAIFailed, validateNew, limit };
}

function formatSourceStats(result: SyncResult): void {
  console.log("╠───────────────────────────────────────────╣");
  console.log("║          Source Statistics                ║");
  for (const [source, stats] of Object.entries(result.sourceStats)) {
    console.log(`║  ${source.padEnd(15)} ${String(stats.fetched).padStart(6)} fetched        ║`);
    if (stats.filtered > 0) {
      console.log(`║                   ${String(stats.filtered).padStart(6)} filtered        ║`);
    }
    if (stats.errors > 0) {
      console.log(`║                   ${String(stats.errors).padStart(6)} errors          ║`);
    }
  }
}

async function main() {
  const startTime = Date.now();
  const { sources, skipAI, forceRefresh, retryAIFailed, validateNew, limit } = parseArgs();

  console.log("╔═══════════════════════════════════════════╗");
  console.log("║       MCP Hub - Multi-Source Sync         ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is required");
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.warn("WARNING: GITHUB_TOKEN not set - GitHub API rate limits will be very low\n");
  }

  console.log(`Sources: ${sources.join(", ")}`);
  if (limit) console.log(`Limit: ${limit} servers per source`);

  if (retryAIFailed) {
    console.log("Mode: RETRY AI FAILED (re-processing servers with empty tools)\n");
  }

  if (skipAI) {
    console.log("AI parsing: DISABLED (set ANTHROPIC_API_KEY or OPENROUTER_API_KEY)\n");
  } else {
    const provider = process.env.OPENROUTER_API_KEY ? "OpenRouter" : "Anthropic";
    console.log(`AI parsing: ENABLED (via ${provider})\n`);
  }

  if (validateNew) {
    console.log("Validation: ENABLED for new servers (Docker if available)\n");
  }

  const result = await syncServers({
    sources,
    skipAI,
    forceRefresh,
    retryAIFailed,
    validateNew,
    limit,
    concurrency: 5,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║               Sync Results                ║");
  console.log("╠═══════════════════════════════════════════╣");
  console.log(`║  Duration:    ${duration.padStart(10)}s              ║`);
  console.log(`║  Discovered:  ${String(result.checked).padStart(10)}               ║`);
  console.log(`║  Merged:      ${String(result.merged).padStart(10)}               ║`);
  console.log(`║  Updated:     ${String(result.updated).padStart(10)}               ║`);
  console.log(`║  New:         ${String(result.newServers).padStart(10)}               ║`);
  console.log(`║  Skipped:     ${String(result.skipped).padStart(10)}               ║`);
  console.log(`║  DB Errors:   ${String(result.errors).padStart(10)}               ║`);

  if (Object.keys(result.sourceStats).length > 0) {
    formatSourceStats(result);
  }

  if (!skipAI) {
    console.log("╠───────────────────────────────────────────╣");
    console.log(`║  AI Parsed:   ${String(result.aiParsed).padStart(10)}               ║`);
    console.log(`║  AI Failed:   ${String(result.aiFailed).padStart(10)}               ║`);
    console.log(`║  AI Cost:    $${result.aiCost.toFixed(4).padStart(9)}               ║`);
  }

  if (validateNew && (result.validated > 0 || result.validationFailed > 0)) {
    console.log("╠───────────────────────────────────────────╣");
    console.log("║          Validation Results               ║");
    console.log(`║  Validated:   ${String(result.validated).padStart(10)}               ║`);
    console.log(`║  Failed:      ${String(result.validationFailed).padStart(10)}               ║`);
  }
  console.log("╚═══════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
