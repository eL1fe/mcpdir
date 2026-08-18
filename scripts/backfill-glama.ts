#!/usr/bin/env npx tsx

import { createHash, randomUUID } from "crypto";
import { config } from "dotenv";
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { jsonrepair } from "jsonrepair";
import pLimit from "p-limit";
import { db } from "../src/lib/db/client";
import {
  categories,
  serverCategories,
  servers,
  serverSources,
  serverTags,
  syncCheckpoints,
  tags,
} from "../src/lib/db/schema";
import { normalizeGitHubUrl } from "./lib/sources/base";

config({ path: ".env.local" });

const SOURCE = "glama-backfill";
const GLAMA_API_URL = "https://glama.ai/api/mcp/v1/servers";
const LEASE_MS = 25 * 60 * 1000;

interface GlamaServer {
  id: string;
  name: string;
  namespace: string;
  slug: string;
  description?: string;
  url: string;
  tools?: Array<{ name: string; description?: string }>;
  repository?: { url: string };
  environmentVariablesJsonSchema?: Record<string, unknown>;
}

interface GlamaResponse {
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
  };
  servers: GlamaServer[];
}

interface GitHubRepo {
  id: number;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
}

interface ExistingServer {
  id: string;
  slug: string;
  sourceUrl: string;
  githubRepoId: number | null;
  glamaSlug: string | null;
  discoveredSources: string[] | null;
}

interface ResolvedServer {
  glama: GlamaServer;
  glamaUrl: string;
  glamaSlug: string;
  canonicalUrl: string;
  github?: GitHubRepo;
  existing?: ExistingServer;
  serverId?: string;
  skipReason?: string;
}

function parseLimit(): number {
  const value = process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
  const parsed = value ? Number.parseInt(value, 10) : 500;
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5000) {
    throw new Error("--limit must be between 1 and 5000");
  }
  return parsed;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function makeSlug(name: string, canonicalUrl: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 220) || "mcp-server";
  const suffix = createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 12);
  return `${base}-${suffix}`;
}

function parseGlamaResponse(raw: string): GlamaResponse {
  try {
    return JSON.parse(raw) as GlamaResponse;
  } catch {
    return JSON.parse(jsonrepair(raw)) as GlamaResponse;
  }
}

async function fetchGlamaPage(cursor: string | null): Promise<GlamaResponse> {
  const url = cursor
    ? `${GLAMA_API_URL}?after=${encodeURIComponent(cursor)}`
    : GLAMA_API_URL;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Glama API returned ${response.status}`);
  }
  return parseGlamaResponse(await response.text());
}

async function fetchGitHubRepo(url: string): Promise<GitHubRepo | null> {
  const normalized = normalizeGitHubUrl(url);
  if (!normalized) return null;
  const path = normalized.replace("https://github.com/", "");
  const response = await fetch(`https://api.github.com/repos/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "MCPDir-Glama-Backfill/1.0",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });

  if (response.status === 404) return null;
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error(`GitHub rate limit reached; reset=${response.headers.get("x-ratelimit-reset") || "unknown"}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status} for ${path}`);
  }
  return response.json() as Promise<GitHubRepo>;
}

async function acquireLease(runId: string) {
  const now = new Date();
  await db
    .insert(syncCheckpoints)
    .values({ source: SOURCE })
    .onConflictDoNothing();

  const [checkpoint] = await db
    .update(syncCheckpoints)
    .set({
      status: "running",
      leaseOwner: runId,
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      lastRunAt: now,
      lastError: null,
      updatedAt: now,
    })
    .where(and(
      eq(syncCheckpoints.source, SOURCE),
      ne(syncCheckpoints.status, "completed"),
      or(isNull(syncCheckpoints.leaseUntil), lt(syncCheckpoints.leaseUntil, now)),
    ))
    .returning();

  if (checkpoint) return checkpoint;

  const [current] = await db
    .select()
    .from(syncCheckpoints)
    .where(eq(syncCheckpoints.source, SOURCE))
    .limit(1);
  return current;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required for duplicate-safe backfill");

  const limit = parseLimit();
  const runId = randomUUID();
  const checkpoint = await acquireLease(runId);

  if (checkpoint.status === "completed") {
    console.log(`Glama backfill already completed: ${checkpoint.processedCount} processed`);
    return;
  }
  if (checkpoint.leaseOwner !== runId) {
    console.log(`Another Glama backfill run owns the lease until ${checkpoint.leaseUntil?.toISOString()}`);
    return;
  }

  const existingRows = await db
    .select({
      id: servers.id,
      slug: servers.slug,
      sourceUrl: servers.sourceUrl,
      githubRepoId: servers.githubRepoId,
      glamaSlug: servers.glamaSlug,
      discoveredSources: servers.discoveredSources,
    })
    .from(servers);

  const byUrl = new Map(existingRows.map((row) => [normalizeUrl(row.sourceUrl), row]));
  const byGlamaSlug = new Map(
    existingRows.filter((row) => row.glamaSlug).map((row) => [row.glamaSlug!.toLowerCase(), row]),
  );
  const byGitHubId = new Map<number, ExistingServer>();
  for (const row of existingRows) {
    if (row.githubRepoId && !byGitHubId.has(row.githubRepoId)) {
      byGitHubId.set(row.githubRepoId, row);
    }
  }

  const [otherCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, "other"))
    .limit(1);
  const [communityTag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, "community"))
    .limit(1);

  const githubLimit = pLimit(3);
  let cursor = checkpoint.cursor;
  let processedThisRun = 0;
  let insertedThisRun = 0;
  let updatedThisRun = 0;
  let skippedThisRun = 0;
  let completed = false;

  try {
    while (processedThisRun < limit && !completed) {
      const page = await fetchGlamaPage(cursor);
      if (page.servers.length === 0 && page.pageInfo.hasNextPage) {
        throw new Error("Glama returned an empty page with hasNextPage=true");
      }

      const unique = new Map<string, GlamaServer>();
      for (const item of page.servers) {
        const glamaSlug = `@${item.namespace}/${item.slug}`.toLowerCase();
        const initialUrl = item.repository?.url
          ? normalizeGitHubUrl(item.repository.url)
          : null;
        unique.set(initialUrl ? normalizeUrl(initialUrl) : glamaSlug, item);
      }

      const resolved = await Promise.all([...unique.values()].map((item) => githubLimit(async (): Promise<ResolvedServer> => {
        const glamaUrl = item.url.startsWith("http") ? item.url : `https://glama.ai${item.url}`;
        const glamaSlug = `@${item.namespace}/${item.slug}`.toLowerCase();
        const initialUrl = item.repository?.url ? normalizeGitHubUrl(item.repository.url) : null;
        const directMatch = (initialUrl ? byUrl.get(normalizeUrl(initialUrl)) : undefined)
          || byGlamaSlug.get(glamaSlug);

        if (directMatch) {
          return {
            glama: item,
            glamaUrl,
            glamaSlug,
            canonicalUrl: directMatch.sourceUrl,
            existing: directMatch,
          };
        }

        if (!initialUrl) {
          return { glama: item, glamaUrl, glamaSlug, canonicalUrl: normalizeUrl(glamaUrl) };
        }

        const github = await fetchGitHubRepo(initialUrl);
        if (!github) {
          return {
            glama: item,
            glamaUrl,
            glamaSlug,
            canonicalUrl: normalizeUrl(initialUrl),
            skipReason: "GitHub repository not found",
          };
        }

        const canonicalUrl = normalizeUrl(normalizeGitHubUrl(github.html_url) || github.html_url);
        const existing = byUrl.get(canonicalUrl) || byGitHubId.get(github.id);
        return { glama: item, glamaUrl, glamaSlug, canonicalUrl, github, existing };
      })));

      let pageInserted = 0;
      let pageUpdated = 0;
      let pageSkipped = page.servers.length - unique.size;

      await db.transaction(async (tx) => {
        for (const item of resolved) {
          if (item.skipReason) {
            pageSkipped++;
            continue;
          }

          const discoveredSources = Array.from(new Set([
            ...(item.existing?.discoveredSources || []),
            "glama",
          ]));
          let serverId = item.existing?.id;

          if (serverId) {
            await tx
              .update(servers)
              .set({
                sourceUrl: item.canonicalUrl,
                description: sql`coalesce(${servers.description}, ${item.glama.description || null})`,
                homepageUrl: item.glamaUrl,
                githubRepoId: item.github?.id || item.existing?.githubRepoId,
                starsCount: item.github?.stargazers_count,
                forksCount: item.github?.forks_count,
                lastCommitAt: item.github?.pushed_at ? new Date(item.github.pushed_at) : undefined,
                envConfigSchema: item.glama.environmentVariablesJsonSchema,
                glamaSlug: item.glamaSlug,
                glamaEnrichedAt: new Date(),
                discoveredSources,
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(servers.id, serverId));
            pageUpdated++;
          } else {
            const [inserted] = await tx
              .insert(servers)
              .values({
                slug: makeSlug(item.glama.name, item.canonicalUrl),
                name: item.glama.name.slice(0, 255),
                description: item.glama.description || null,
                sourceType: "glama",
                sourceUrl: item.canonicalUrl,
                homepageUrl: item.glamaUrl,
                tools: item.glama.tools || [],
                envConfigSchema: item.glama.environmentVariablesJsonSchema || null,
                starsCount: item.github?.stargazers_count || 0,
                forksCount: item.github?.forks_count || 0,
                githubRepoId: item.github?.id,
                lastCommitAt: item.github?.pushed_at ? new Date(item.github.pushed_at) : null,
                status: "active",
                discoveredSources: ["glama"],
                glamaSlug: item.glamaSlug,
                glamaEnrichedAt: new Date(),
                lastSyncedAt: new Date(),
              })
              .onConflictDoNothing({ target: servers.sourceUrl })
              .returning({ id: servers.id });

            if (inserted) {
              serverId = inserted.id;
              pageInserted++;
            } else {
              const [raceWinner] = await tx
                .select({ id: servers.id })
                .from(servers)
                .where(sql`lower(${servers.sourceUrl}) = ${item.canonicalUrl}`)
                .limit(1);
              serverId = raceWinner?.id;
              pageUpdated++;
            }
          }

          if (!serverId) throw new Error(`Could not resolve server row for ${item.canonicalUrl}`);
          item.serverId = serverId;

          await tx
            .insert(serverSources)
            .values({
              serverId,
              source: "glama",
              sourceIdentifier: item.glama.id,
              sourceUrl: item.glamaUrl,
              sourceData: item.glama,
              lastSeenAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [serverSources.serverId, serverSources.source],
              set: {
                sourceIdentifier: item.glama.id,
                sourceUrl: item.glamaUrl,
                sourceData: item.glama,
                lastSeenAt: new Date(),
              },
            });

          if (!item.existing && otherCategory) {
            await tx.insert(serverCategories).values({ serverId, categoryId: otherCategory.id }).onConflictDoNothing();
          }
          if (!item.existing && communityTag) {
            await tx.insert(serverTags).values({ serverId, tagId: communityTag.id }).onConflictDoNothing();
          }
        }

        completed = !page.pageInfo.hasNextPage;
        cursor = completed ? null : page.pageInfo.endCursor;
        await tx
          .update(syncCheckpoints)
          .set({
            cursor,
            status: completed ? "completed" : "running",
            leaseUntil: new Date(Date.now() + LEASE_MS),
            processedCount: sql`${syncCheckpoints.processedCount} + ${page.servers.length}`,
            insertedCount: sql`${syncCheckpoints.insertedCount} + ${pageInserted}`,
            updatedCount: sql`${syncCheckpoints.updatedCount} + ${pageUpdated}`,
            skippedCount: sql`${syncCheckpoints.skippedCount} + ${pageSkipped}`,
            completedAt: completed ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(syncCheckpoints.source, SOURCE),
            eq(syncCheckpoints.leaseOwner, runId),
          ));
      });

      for (const item of resolved) {
        if (item.skipReason) continue;
        const row: ExistingServer = item.existing || {
          id: item.serverId!,
          slug: makeSlug(item.glama.name, item.canonicalUrl),
          sourceUrl: item.canonicalUrl,
          githubRepoId: item.github?.id || null,
          glamaSlug: item.glamaSlug,
          discoveredSources: ["glama"],
        };
        byUrl.set(item.canonicalUrl, row);
        byGlamaSlug.set(item.glamaSlug, row);
        if (item.github?.id) byGitHubId.set(item.github.id, row);
      }

      processedThisRun += page.servers.length;
      insertedThisRun += pageInserted;
      updatedThisRun += pageUpdated;
      skippedThisRun += pageSkipped;
      console.log(`Processed ${processedThisRun}/${limit}: +${insertedThisRun} new, ${updatedThisRun} existing, ${skippedThisRun} skipped`);
    }

    await db
      .update(syncCheckpoints)
      .set({
        status: completed ? "completed" : "pending",
        leaseOwner: null,
        leaseUntil: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(syncCheckpoints.source, SOURCE),
        eq(syncCheckpoints.leaseOwner, runId),
      ));

    console.log(completed
      ? `Glama backfill complete: ${processedThisRun} processed in this run`
      : `Glama backfill checkpoint saved after ${processedThisRun} records`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(syncCheckpoints)
      .set({
        status: "failed",
        leaseOwner: null,
        leaseUntil: null,
        lastError: message.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(and(
        eq(syncCheckpoints.source, SOURCE),
        eq(syncCheckpoints.leaseOwner, runId),
      ));
    throw error;
  }
}

main().catch((error) => {
  console.error("Glama backfill failed:", error);
  process.exit(1);
});
