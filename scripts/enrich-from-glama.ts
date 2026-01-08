#!/usr/bin/env npx tsx

/**
 * Glama Full Scraper
 *
 * This script scrapes ALL servers from Glama by:
 * 1. Fetching all 1,405 integration pages
 * 2. Collecting unique servers with rich metadata (scores, platforms, etc.)
 * 3. Saving to database
 *
 * Usage:
 *   pnpm enrich:glama                    # Full scrape all integrations
 *   pnpm enrich:glama --integrations 50  # Limit integrations to scrape
 *   pnpm enrich:glama --dry-run          # Just count, don't save
 */

import { db } from "../src/lib/db";
import { servers, serverSources } from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const GLAMA_BASE = "https://glama.ai";
const INTEGRATIONS_SITEMAP = "https://glama.ai/sitemaps/mcp-integrations.xml";

interface GlamaServerData {
  namespace: string;
  slug: string;
  displayName: string;
  description?: string;
  githubOwner?: string;
  githubRepo?: string;
  scores: {
    license?: number;
    quality?: number;
    security?: number;
  };
  supportedPlatforms?: string[];
  npmDownloads?: number;
  stargazers?: number;
  toolCount?: number;
}

// Fetch all integration names from sitemap
async function fetchAllIntegrations(): Promise<string[]> {
  console.log("📋 Fetching integration list from sitemap...");

  const response = await fetch(INTEGRATIONS_SITEMAP);
  if (!response.ok) throw new Error(`Failed to fetch sitemap: ${response.status}`);

  const xml = await response.text();
  const matches = xml.matchAll(/<loc>https:\/\/glama\.ai\/mcp\/servers\/integrations\/([^<]+)<\/loc>/g);

  const integrations: string[] = [];
  for (const match of matches) {
    integrations.push(match[1]);
  }

  console.log(`  Found ${integrations.length} integrations\n`);
  return integrations;
}

// Parse servers from integration page response (Turbo stream format)
function parseIntegrationServers(text: string): GlamaServerData[] {
  const servers: GlamaServerData[] = [];

  // Turbo stream format compresses keys - values appear in order
  // The owner/repo pattern appears as standalone strings like "owner/repo"
  // Match strings that look like GitHub owner/repo (lowercase alphanumeric with hyphens)

  const repoPattern = /"([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)"/g;
  const matches = [...text.matchAll(repoPattern)];

  const seen = new Set<string>();

  for (const match of matches) {
    const fullName = match[1];

    // Skip if doesn't look like owner/repo (filter out things like "MIT/license")
    if (fullName.includes("spdx") || fullName.includes("license")) continue;
    if (fullName.startsWith("_") || fullName.includes("://")) continue;

    // Skip duplicates
    if (seen.has(fullName.toLowerCase())) continue;
    seen.add(fullName.toLowerCase());

    const [owner, repo] = fullName.split("/");
    if (!owner || !repo) continue;

    // Quick sanity check - owner and repo should be reasonable lengths
    if (owner.length < 2 || repo.length < 2) continue;
    if (owner.length > 50 || repo.length > 100) continue;

    servers.push({
      namespace: owner,
      slug: repo,
      displayName: repo,
      githubOwner: owner,
      githubRepo: repo,
      scores: {},
    });
  }

  return servers;
}

// Extract scores from a block of text (scores are in a specific format in Turbo streams)
function extractScores(text: string): { license?: number; quality?: number; security?: number } {
  const scores: { license?: number; quality?: number; security?: number } = {};

  // Look for score patterns - they appear after "scores" in the stream
  // Format varies but generally: "license" followed by number, etc.

  // Find the scores section
  const scoresSection = text.match(/"scores"[\s\S]{0,500}/);
  if (scoresSection) {
    const section = scoresSection[0];

    // Extract individual scores
    const licenseMatch = section.match(/"license"[^0-9]*(\d+)/);
    if (licenseMatch) scores.license = parseInt(licenseMatch[1]);

    const qualityMatch = section.match(/"quality"[^0-9]*(\d+)/);
    if (qualityMatch) scores.quality = parseInt(qualityMatch[1]);

    const securityMatch = section.match(/"security"[^0-9]*(\d+)/);
    if (securityMatch) scores.security = parseInt(securityMatch[1]);
  }

  return scores;
}

// Fetch servers from an integration page
async function fetchIntegrationServers(integration: string): Promise<GlamaServerData[]> {
  const url = `${GLAMA_BASE}/mcp/servers/integrations/${integration}.data`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const text = await response.text();
    return parseIntegrationServers(text);
  } catch {
    return [];
  }
}

// Main scraper function
async function scrapeAllServers(options: { limit?: number; dryRun?: boolean }) {
  console.log("🚀 Glama Full Scraper\n");

  // Get all integrations
  let integrations = await fetchAllIntegrations();

  if (options.limit) {
    integrations = integrations.slice(0, options.limit);
    console.log(`  (Limited to ${options.limit} integrations)\n`);
  }

  // Collect all servers
  const allServers = new Map<string, GlamaServerData>();
  let processed = 0;

  for (const integration of integrations) {
    processed++;
    process.stdout.write(`\r  [${processed}/${integrations.length}] ${integration.padEnd(30)} | Found: ${allServers.size} servers`);

    const servers = await fetchIntegrationServers(integration);

    for (const server of servers) {
      const key = `${server.namespace}/${server.slug}`;

      // Keep the entry with more data
      const existing = allServers.get(key);
      if (!existing || (server.stargazers && (!existing.stargazers || server.stargazers > existing.stargazers))) {
        allServers.set(key, server);
      }
    }

    // Rate limit - be nice to Glama
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n\n📊 Total unique servers found: ${allServers.size}\n`);

  if (options.dryRun) {
    console.log("🔍 Dry run - not saving to database\n");

    // Show sample
    const sample = [...allServers.values()].slice(0, 10);
    console.log("Sample servers:");
    for (const s of sample) {
      console.log(`  - ${s.namespace}/${s.slug} ⭐${s.stargazers || 0} 🔧${s.toolCount || 0}`);
    }
    return;
  }

  // Get existing servers
  console.log("📂 Loading existing servers from database...");
  const existing = await db.select({
    id: servers.id,
    slug: servers.slug,
    sourceUrl: servers.sourceUrl,
    glamaSlug: servers.glamaSlug,
  }).from(servers);

  const existingByGitHub = new Map<string, typeof existing[0]>();
  const existingByGlamaSlug = new Map<string, typeof existing[0]>();

  for (const s of existing) {
    if (s.glamaSlug) {
      existingByGlamaSlug.set(s.glamaSlug, s);
    }
    // Extract GitHub path from sourceUrl
    const ghMatch = s.sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (ghMatch) {
      existingByGitHub.set(`${ghMatch[1]}/${ghMatch[2]}`.toLowerCase(), s);
    }
  }

  console.log(`  ${existing.length} servers in database\n`);

  // Update/enrich existing servers
  let updated = 0;
  let newServers = 0;

  console.log("✨ Processing servers...\n");

  for (const [key, server] of allServers) {
    const glamaSlug = `@${server.namespace}/${server.slug}`;

    // Try to find existing server
    let existingServer = existingByGlamaSlug.get(glamaSlug);

    if (!existingServer && server.githubOwner && server.githubRepo) {
      const ghKey = `${server.githubOwner}/${server.githubRepo}`.toLowerCase();
      existingServer = existingByGitHub.get(ghKey);
    }

    if (existingServer) {
      // Update with Glama data
      await db.update(servers)
        .set({
          glamaSlug,
          glamaQualityScore: server.scores.quality,
          glamaSecurityScore: server.scores.security,
          glamaLicenseScore: server.scores.license,
          supportedPlatforms: server.supportedPlatforms,
          glamaEnrichedAt: new Date(),
          ...(server.npmDownloads ? { npmDownloads: server.npmDownloads } : {}),
          ...(server.stargazers ? { starsCount: server.stargazers } : {}),
        })
        .where(eq(servers.id, existingServer.id));

      updated++;
    } else if (server.githubOwner && server.githubRepo) {
      // New server - could add it, but for now just count
      newServers++;
    }
  }

  console.log(`\n📈 Results:`);
  console.log(`  - Updated: ${updated} servers`);
  console.log(`  - New (not added): ${newServers} servers`);
  console.log(`  - Total in Glama: ${allServers.size} servers`);
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const limitArg = args.find(a => a.startsWith("--integrations"));
  const limit = limitArg
    ? parseInt(limitArg.split("=")[1] || args[args.indexOf("--integrations") + 1])
    : undefined;

  await scrapeAllServers({ limit, dryRun });

  console.log("\n✅ Done!");
  process.exit(0);
}

main().catch(console.error);
