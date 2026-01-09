#!/usr/bin/env npx tsx

/**
 * Refresh GitHub Stats
 *
 * Lightweight script to update stars/forks for existing servers.
 * Much faster than full sync - only queries GitHub API for stats.
 *
 * Usage:
 *   pnpm tsx scripts/refresh-github-stats.ts
 *   pnpm tsx scripts/refresh-github-stats.ts --limit=100
 *   pnpm tsx scripts/refresh-github-stats.ts --batch=50
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNotNull, and, sql } from "drizzle-orm";
import { servers } from "../src/lib/db/schema";

config({ path: ".env.local" });

const GITHUB_API = "https://api.github.com";
const BATCH_SIZE = 50;
const DELAY_MS = 100;

interface GitHubRepo {
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  archived: boolean;
}

async function fetchRepoStats(owner: string, repo: string): Promise<GitHubRepo | null> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "MCPDir-Stats/1.0",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      }),
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 403) {
      const reset = response.headers.get("x-ratelimit-reset");
      console.warn(`Rate limited. Reset at: ${reset ? new Date(parseInt(reset) * 1000) : "unknown"}`);
      return null;
    }
    return null;
  }

  return response.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;
  const batchArg = args.find((a) => a.startsWith("--batch="));
  const batchSize = batchArg ? parseInt(batchArg.split("=")[1]) : BATCH_SIZE;

  console.log("╔═══════════════════════════════════════════╗");
  console.log("║     GitHub Stats Refresh                  ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL required");
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.warn("WARNING: GITHUB_TOKEN not set - rate limits will be low (60/hour)\n");
  }

  const sqlClient = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlClient);

  // Get servers with GitHub info
  const query = db
    .select({
      id: servers.id,
      slug: servers.slug,
      githubOwner: servers.githubOwner,
      githubRepo: servers.githubRepo,
      stars: servers.stars,
    })
    .from(servers)
    .where(and(isNotNull(servers.githubOwner), isNotNull(servers.githubRepo)))
    .orderBy(sql`${servers.updatedAt} ASC NULLS FIRST`);

  const allServers = limit ? await query.limit(limit) : await query;

  console.log(`Found ${allServers.length} servers with GitHub repos\n`);

  let updated = 0;
  let failed = 0;
  let unchanged = 0;

  for (let i = 0; i < allServers.length; i += batchSize) {
    const batch = allServers.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allServers.length / batchSize)}...`);

    for (const server of batch) {
      await delay(DELAY_MS);

      const stats = await fetchRepoStats(server.githubOwner!, server.githubRepo!);

      if (!stats) {
        failed++;
        continue;
      }

      const newStars = stats.stargazers_count;
      const newForks = stats.forks_count;

      if (server.stars === newStars) {
        unchanged++;
        continue;
      }

      await db
        .update(servers)
        .set({
          stars: newStars,
          forks: newForks,
          updatedAt: new Date(),
        })
        .where(eq(servers.id, server.id));

      console.log(`  ${server.slug}: ${server.stars ?? 0} → ${newStars} stars`);
      updated++;
    }
  }

  console.log(`
╔═══════════════════════════════════════════╗
║              Summary                      ║
╠═══════════════════════════════════════════╣
║  Updated:   ${String(updated).padStart(6)}                      ║
║  Unchanged: ${String(unchanged).padStart(6)}                      ║
║  Failed:    ${String(failed).padStart(6)}                      ║
╚═══════════════════════════════════════════╝
`);
}

main().catch(console.error);
