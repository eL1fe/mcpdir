#!/usr/bin/env tsx
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { servers } from "../src/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { processReadme, parseGitHubUrl } from "./lib/readme-processor";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  const slug = process.argv[2];

  if (slug) {
    // Process single server
    const [server] = await db
      .select({
        id: servers.id,
        slug: servers.slug,
        readme: servers.readmeContent,
        sourceUrl: servers.sourceUrl,
      })
      .from(servers)
      .where(eq(servers.slug, slug))
      .limit(1);

    if (!server || !server.readme || !server.sourceUrl) {
      console.log("Server not found or no README:", slug);
      return;
    }

    const parsed = parseGitHubUrl(server.sourceUrl);
    if (!parsed) {
      console.log("Could not parse GitHub URL:", server.sourceUrl);
      return;
    }

    const processed = processReadme(server.readme, parsed.owner, parsed.repo, "main");

    const picturesBefore = (server.readme.match(/<picture/g) || []).length;
    const picturesAfter = (processed.match(/<picture/g) || []).length;

    console.log("Before:", picturesBefore, "picture tags");
    console.log("After:", picturesAfter, "picture tags");

    await db.update(servers).set({ readmeContent: processed }).where(eq(servers.id, server.id));

    console.log("✅ Updated:", server.slug);
  } else {
    console.log("Usage: npx tsx scripts/reprocess-readme.ts <slug>");
    console.log("  or: npx tsx scripts/reprocess-readme.ts --all (process all servers)");
  }
}

main().catch(console.error);
