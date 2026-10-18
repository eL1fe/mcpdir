#!/usr/bin/env npx tsx

/**
 * Adds the "media" category to existing servers whose name or description
 * matches the media keywords used by sync. Regular sync skips servers it has
 * already seen, so they never pick up a new category on their own.
 *
 * Dry run by default. Usage:
 *   pnpm backfill:media                     # report only
 *   pnpm backfill:media --out media.tsv     # also write every match to a TSV
 *   pnpm backfill:media --apply             # write to the database
 */

import { writeFileSync } from "fs";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db, getSql } from "../src/lib/db/client";
import { categories, serverCategories, servers } from "../src/lib/db/schema";
import { matchMediaKeyword } from "./lib/media-category";

const PAGE_SIZE = 5000;
const WRITE_CHUNK = 1000;
const SAMPLE_SIZE = 25;

const MEDIA_CATEGORY = {
  slug: "media",
  name: "Media",
  description: "Video, audio, music, images, and stock footage",
  icon: "Film",
  displayOrder: 9,
};
const OTHER_DISPLAY_ORDER = 10;

interface Match {
  id: string;
  slug: string;
  name: string;
  keyword: string;
  currentSlugs: string[];
}

function parseArgs() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  return {
    apply: args.includes("--apply"),
    out: outIndex >= 0 ? args[outIndex + 1] : undefined,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function main() {
  const { apply, out } = parseArgs();
  console.log(`Mode: ${apply ? "APPLY" : "dry run"}\n`);

  const allCategories = await db.select().from(categories);
  const slugById = new Map(allCategories.map((c) => [c.id, c.slug]));
  const mediaCategory = allCategories.find((c) => c.slug === "media");
  const otherCategory = allCategories.find((c) => c.slug === "other");

  if (!mediaCategory) {
    console.log(`"media" category does not exist yet${apply ? ", creating it" : " (would be created)"}`);
  }

  const matches: Match[] = [];
  let scanned = 0;
  let lastId: string | undefined;

  while (true) {
    const page = await db
      .select({ id: servers.id, slug: servers.slug, name: servers.name, description: servers.description })
      .from(servers)
      .where(lastId ? gt(servers.id, lastId) : undefined)
      .orderBy(asc(servers.id))
      .limit(PAGE_SIZE);

    if (page.length === 0) break;
    scanned += page.length;
    lastId = page[page.length - 1].id;

    const pageMatches = page
      .map((s) => ({ server: s, keyword: matchMediaKeyword(`${s.name} ${s.description ?? ""}`) }))
      .filter((m): m is { server: (typeof page)[number]; keyword: string } => m.keyword !== null);

    if (pageMatches.length > 0) {
      const links = await db
        .select()
        .from(serverCategories)
        .where(inArray(serverCategories.serverId, pageMatches.map((m) => m.server.id)));

      const slugsByServer = new Map<string, string[]>();
      for (const link of links) {
        const list = slugsByServer.get(link.serverId) ?? [];
        list.push(slugById.get(link.categoryId) ?? link.categoryId);
        slugsByServer.set(link.serverId, list);
      }

      for (const { server, keyword } of pageMatches) {
        matches.push({
          id: server.id,
          slug: server.slug,
          name: server.name,
          keyword,
          currentSlugs: slugsByServer.get(server.id) ?? [],
        });
      }
    }

    process.stdout.write(`\rScanned ${scanned} servers, ${matches.length} matches`);
  }
  console.log("\n");

  const toAdd = matches.filter((m) => !m.currentSlugs.includes("media"));
  // Sync only uses "other" when nothing else matched, so drop it once media is set
  const toDropOther = toAdd.filter((m) => m.currentSlugs.length === 1 && m.currentSlugs[0] === "other");

  const keywordCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const m of toAdd) {
    keywordCounts.set(m.keyword, (keywordCounts.get(m.keyword) ?? 0) + 1);
    for (const slug of m.currentSlugs.length ? m.currentSlugs : ["(none)"]) {
      categoryCounts.set(slug, (categoryCounts.get(slug) ?? 0) + 1);
    }
  }
  const sortDesc = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`Scanned:            ${scanned}`);
  console.log(`Matched keywords:   ${matches.length}`);
  console.log(`Already in media:   ${matches.length - toAdd.length}`);
  console.log(`Will add media:     ${toAdd.length}`);
  console.log(`Will drop "other":  ${toDropOther.length}\n`);

  console.log("Matches by keyword:");
  for (const [keyword, count] of sortDesc(keywordCounts)) console.log(`  ${keyword.padEnd(22)} ${count}`);

  console.log("\nCurrent categories of servers to update:");
  for (const [slug, count] of sortDesc(categoryCounts)) console.log(`  ${slug.padEnd(22)} ${count}`);

  console.log(`\nSample (${Math.min(SAMPLE_SIZE, toAdd.length)} of ${toAdd.length}):`);
  for (const m of toAdd.slice(0, SAMPLE_SIZE)) {
    console.log(`  [${m.keyword}] ${m.name} (${m.currentSlugs.join(", ") || "no categories"})`);
  }

  if (out) {
    const rows = toAdd.map((m) => [m.slug, m.name, m.keyword, m.currentSlugs.join(",")].join("\t"));
    writeFileSync(out, ["slug\tname\tkeyword\tcurrent_categories", ...rows].join("\n") + "\n");
    console.log(`\nWrote ${toAdd.length} rows to ${out}`);
  }

  if (!apply) {
    console.log("\nDry run, nothing written. Re-run with --apply to update the database.");
    return;
  }

  const mediaId =
    mediaCategory?.id ??
    (await db.insert(categories).values(MEDIA_CATEGORY).returning({ id: categories.id }))[0].id;

  if (otherCategory && otherCategory.displayOrder !== OTHER_DISPLAY_ORDER) {
    await db.update(categories).set({ displayOrder: OTHER_DISPLAY_ORDER }).where(eq(categories.id, otherCategory.id));
  }

  for (const ids of chunk(toAdd.map((m) => m.id), WRITE_CHUNK)) {
    await db
      .insert(serverCategories)
      .values(ids.map((serverId) => ({ serverId, categoryId: mediaId })))
      .onConflictDoNothing();
  }

  if (otherCategory) {
    for (const ids of chunk(toDropOther.map((m) => m.id), WRITE_CHUNK)) {
      await db
        .delete(serverCategories)
        .where(and(eq(serverCategories.categoryId, otherCategory.id), inArray(serverCategories.serverId, ids)));
    }
  }

  console.log(`\nApplied: added media to ${toAdd.length} servers, removed "other" from ${toDropOther.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getSql().end());
