#!/usr/bin/env tsx
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { servers } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { parseServerWithAI } from "./lib/ai-parser";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  const slug = process.argv[2] || "io-github-github-github-mcp-server";

  const [server] = await db
    .select()
    .from(servers)
    .where(eq(servers.slug, slug))
    .limit(1);

  if (!server) {
    console.log("Server not found:", slug);
    return;
  }

  console.log("Server:", server.name);
  console.log("README length:", server.readmeContent?.length || 0);

  if (!server.readmeContent) {
    console.log("No README content");
    return;
  }

  console.log("\nParsing with AI...\n");

  const result = await parseServerWithAI(
    server.name || "",
    server.description || "",
    server.readmeContent
  );

  if (result) {
    console.log("Tools found:", result.tools.length);
    console.log("\nTools:");
    result.tools.forEach((t) => console.log(" -", t.name, "-", t.description?.slice(0, 50)));
    if (result.tools.length === 0) {
      console.log("  (none found)");
    }
    console.log("\nResources:", result.resources.length);
    console.log("Prompts:", result.prompts.length);
    console.log("Description:", result.enhancedDescription);
    console.log("Categories:", result.suggestedCategories);

    // Update in DB if --update flag passed
    if (process.argv.includes("--update")) {
      await db
        .update(servers)
        .set({
          tools: result.tools,
          resources: result.resources,
          prompts: result.prompts,
          description: result.enhancedDescription,
        })
        .where(eq(servers.slug, slug));
      console.log("\n✅ Updated in database!");
    }
  } else {
    console.log("AI parsing failed");
  }
}

main().catch(console.error);
