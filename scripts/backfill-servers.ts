#!/usr/bin/env tsx
import { config } from "dotenv";
import { db } from "../src/lib/db";
import { servers } from "../src/lib/db/schema";
import { eq, isNull, sql, or, and } from "drizzle-orm";
import { parseServerWithAI } from "./lib/ai-parser";

config({ path: ".env.local" });

const GITHUB_API = "https://api.github.com";
const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY = 100; // ms between GitHub requests

interface BackfillOptions {
  mode: "missing-readme" | "missing-tools" | "missing-any" | "all";
  limit?: number;
  dryRun?: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  let mode: BackfillOptions["mode"] = "missing-any";
  const modeArg = args.find(a => a.startsWith("--mode="));
  if (modeArg) {
    mode = modeArg.split("=")[1] as BackfillOptions["mode"];
  }

  let limit: number | undefined;
  const limitArg = args.find(a => a.startsWith("--limit="));
  if (limitArg) {
    limit = parseInt(limitArg.split("=")[1], 10);
  }

  const dryRun = args.includes("--dry-run");

  return { mode, limit, dryRun };
}

async function fetchGitHubReadme(owner: string, repo: string): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw",
    "User-Agent": "mcpdir-backfill",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Try common README filenames
  const filenames = ["README.md", "readme.md", "Readme.md", "README.MD"];

  for (const filename of filenames) {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filename}`, {
        headers,
      });

      if (res.status === 403) {
        const resetHeader = res.headers.get("x-ratelimit-reset");
        if (resetHeader) {
          const resetTime = parseInt(resetHeader) * 1000;
          const waitTime = Math.max(resetTime - Date.now(), 60000);
          console.log(`  ⏳ Rate limited, waiting ${Math.ceil(waitTime / 1000)}s...`);
          await new Promise(r => setTimeout(r, waitTime));
          // Retry
          const retryRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filename}`, {
            headers,
          });
          if (retryRes.ok) {
            return await retryRes.text();
          }
        }
        return null;
      }

      if (res.ok) {
        return await res.text();
      }
    } catch (err) {
      // Continue to next filename
    }
  }

  return null;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.\#\?]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function backfillServers(options: BackfillOptions) {
  console.log("╔═══════════════════════════════════════════╗");
  console.log("║       MCP Hub - Server Backfill           ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  console.log(`Mode: ${options.mode}`);
  console.log(`Limit: ${options.limit || "none"}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}\n`);

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is required");
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.warn("WARNING: GITHUB_TOKEN not set - GitHub API rate limits will be very low\n");
  }

  // Build query based on mode
  let whereClause;
  switch (options.mode) {
    case "missing-readme":
      whereClause = isNull(servers.readmeContent);
      break;
    case "missing-tools":
      whereClause = and(
        sql`${servers.readmeContent} IS NOT NULL`,
        or(
          isNull(servers.tools),
          sql`${servers.tools} = '[]'::jsonb`
        )
      );
      break;
    case "missing-any":
      whereClause = or(
        isNull(servers.readmeContent),
        isNull(servers.tools),
        sql`${servers.tools} = '[]'::jsonb`
      );
      break;
    case "all":
      whereClause = sql`1=1`;
      break;
  }

  // Get servers to process
  const query = db
    .select({
      id: servers.id,
      slug: servers.slug,
      name: servers.name,
      description: servers.description,
      sourceUrl: servers.sourceUrl,
      readmeContent: servers.readmeContent,
      tools: servers.tools,
    })
    .from(servers)
    .where(whereClause);

  if (options.limit) {
    query.limit(options.limit);
  }

  const serversToProcess = await query;

  console.log(`Found ${serversToProcess.length} servers to process\n`);

  if (options.dryRun) {
    console.log("Dry run - would process:");
    serversToProcess.slice(0, 20).forEach(s => {
      const hasReadme = !!s.readmeContent;
      const hasTools = s.tools && Array.isArray(s.tools) && s.tools.length > 0;
      console.log(`  - ${s.slug}: README=${hasReadme}, tools=${hasTools}`);
    });
    if (serversToProcess.length > 20) {
      console.log(`  ... and ${serversToProcess.length - 20} more`);
    }
    return;
  }

  const stats = {
    processed: 0,
    readmeFetched: 0,
    readmeFailed: 0,
    aiParsed: 0,
    aiFailed: 0,
    updated: 0,
    errors: 0,
  };

  for (let i = 0; i < serversToProcess.length; i++) {
    const server = serversToProcess[i];

    if ((i + 1) % 25 === 0) {
      console.log(`\nProgress: ${i + 1}/${serversToProcess.length} (${Math.round((i + 1) / serversToProcess.length * 100)}%)`);
      console.log(`  README: ${stats.readmeFetched} fetched, ${stats.readmeFailed} failed | AI: ${stats.aiParsed} parsed, ${stats.aiFailed} failed | errors: ${stats.errors}`);
    }

    try {
      let readmeContent = server.readmeContent;
      let needsUpdate = false;
      const updates: Record<string, unknown> = {};

      // Fetch README if missing
      if (!readmeContent && server.sourceUrl) {
        const parsed = parseGitHubUrl(server.sourceUrl);
        if (parsed) {
          await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
          readmeContent = await fetchGitHubReadme(parsed.owner, parsed.repo);

          if (readmeContent) {
            updates.readmeContent = readmeContent;
            stats.readmeFetched++;
            needsUpdate = true;
          } else {
            stats.readmeFailed++;
            // Log first few failures for debugging
            if (stats.readmeFailed <= 3) {
              console.log(`  ⚠ No README: ${parsed.owner}/${parsed.repo} (${server.sourceUrl})`);
            }
          }
        }
      }

      // Parse with AI if we have README but no tools
      const hasTools = server.tools && Array.isArray(server.tools) && server.tools.length > 0;
      if (readmeContent && !hasTools) {
        const aiData = await parseServerWithAI(
          server.name,
          server.description || "",
          readmeContent
        );

        if (aiData) {
          updates.tools = aiData.tools || [];
          updates.resources = aiData.resources || [];
          updates.prompts = aiData.prompts || [];
          updates.capabilities = aiData.capabilities || {};
          stats.aiParsed++;
          needsUpdate = true;
        } else {
          stats.aiFailed++;
        }
      }

      // Update database
      if (needsUpdate && Object.keys(updates).length > 0) {
        await db
          .update(servers)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(servers.id, server.id));
        stats.updated++;
      }

      stats.processed++;
    } catch (err) {
      console.error(`  ✗ Error processing ${server.slug}:`, err);
      stats.errors++;
    }
  }

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║            Backfill Results               ║");
  console.log("╠═══════════════════════════════════════════╣");
  console.log(`║  Processed:        ${String(stats.processed).padStart(6)}               ║`);
  console.log(`║  README fetched:   ${String(stats.readmeFetched).padStart(6)}               ║`);
  console.log(`║  README failed:    ${String(stats.readmeFailed).padStart(6)}               ║`);
  console.log(`║  AI parsed:        ${String(stats.aiParsed).padStart(6)}               ║`);
  console.log(`║  AI failed:        ${String(stats.aiFailed).padStart(6)}               ║`);
  console.log(`║  DB updated:       ${String(stats.updated).padStart(6)}               ║`);
  console.log(`║  Errors:           ${String(stats.errors).padStart(6)}               ║`);
  console.log("╚═══════════════════════════════════════════╝");
}

backfillServers(parseArgs()).catch(console.error);
