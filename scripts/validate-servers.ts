#!/usr/bin/env tsx
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq, isNull, or, desc, and, gt } from "drizzle-orm";
import pLimit from "p-limit";
import { servers } from "../src/lib/db/schema";
import { validateMcpServer, detectRequiresConfig } from "./lib/mcp-validator";

config({ path: ".env.local" });

// Lazy initialization of database connection
let db: NeonHttpDatabase | null = null;

function getDb(): NeonHttpDatabase {
  if (!db) {
    const sqlClient = neon(process.env.DATABASE_URL!);
    db = drizzle(sqlClient);
  }
  return db;
}

interface ValidateOptions {
  limit?: number;
  slug?: string;
  popularOnly?: boolean;
  concurrency?: number;
  skipPython?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const options: ValidateOptions = {
    limit: 100,
    concurrency: 3,
    skipPython: true, // Skip Python servers by default (require uv)
  };

  // Parse CLI args
  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--slug=")) {
      options.slug = arg.split("=")[1];
    } else if (arg === "--popular") {
      options.popularOnly = true;
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--include-python") {
      options.skipPython = false;
    }
  }

  const startTime = Date.now();

  console.log("╔═══════════════════════════════════════════╗");
  console.log("║     MCP Hub - Server Validation           ║");
  console.log("╚═══════════════════════════════════════════╝\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is required");
    process.exit(1);
  }

  const database = getDb();
  const limit = pLimit(options.concurrency!);

  // Build query conditions
  let toValidate;

  if (options.slug) {
    // Validate specific server
    toValidate = await database
      .select()
      .from(servers)
      .where(eq(servers.slug, options.slug))
      .limit(1);
    console.log(`Validating specific server: ${options.slug}\n`);
  } else {
    // Get servers that need validation
    const conditions = [
      or(
        isNull(servers.validationStatus),
        eq(servers.validationStatus, "pending")
      ),
    ];

    if (options.popularOnly) {
      conditions.push(gt(servers.starsCount, 100));
      console.log("Mode: Popular servers only (100+ stars)\n");
    }

    toValidate = await database
      .select()
      .from(servers)
      .where(and(...conditions))
      .orderBy(desc(servers.starsCount))
      .limit(options.limit!);

    console.log(`Found ${toValidate.length} servers to validate\n`);
  }

  if (toValidate.length === 0) {
    console.log("No servers need validation.");
    return;
  }

  let validated = 0;
  let failed = 0;
  let skipped = 0;
  let needsConfig = 0;

  const results = await Promise.all(
    toValidate.map((server) =>
      limit(async () => {
        const serverName = server.name || server.slug;

        // Skip if no install command
        if (!server.installCommand) {
          await database
            .update(servers)
            .set({
              validationStatus: "skipped",
              validationError: "No install command",
              validatedAt: new Date(),
            })
            .where(eq(servers.id, server.id));
          console.log(`⏭️  ${serverName} - skipped (no install command)`);
          skipped++;
          return { status: "skipped" };
        }

        // Skip Python servers if option set
        if (options.skipPython && server.installCommand.startsWith("uvx")) {
          await database
            .update(servers)
            .set({
              validationStatus: "skipped",
              validationError: "Python server (uvx) - skipped",
              validatedAt: new Date(),
            })
            .where(eq(servers.id, server.id));
          console.log(`⏭️  ${serverName} - skipped (Python/uvx)`);
          skipped++;
          return { status: "skipped" };
        }

        // Check if requires config
        if (server.readmeContent && detectRequiresConfig(server.readmeContent)) {
          await database
            .update(servers)
            .set({
              validationStatus: "needs_config",
              validationError: "Requires API keys or configuration",
              validatedAt: new Date(),
            })
            .where(eq(servers.id, server.id));
          console.log(`⚙️  ${serverName} - needs config`);
          needsConfig++;
          return { status: "needs_config" };
        }

        console.log(`🔍 Validating: ${serverName}...`);

        const result = await validateMcpServer(server.installCommand);

        if (result.success) {
          await database
            .update(servers)
            .set({
              validationStatus: "validated",
              validatedAt: new Date(),
              validationResult: result,
              validationDurationMs: result.durationMs,
              validationError: null,
              // Update tools/resources with actual data if we got any
              ...(result.tools && result.tools.length > 0
                ? { tools: result.tools }
                : {}),
              ...(result.resources && result.resources.length > 0
                ? { resources: result.resources }
                : {}),
              ...(result.prompts && result.prompts.length > 0
                ? { prompts: result.prompts }
                : {}),
            })
            .where(eq(servers.id, server.id));

          const toolCount = result.tools?.length ?? 0;
          const resourceCount = result.resources?.length ?? 0;
          console.log(
            `✅ ${serverName} - validated (${toolCount} tools, ${resourceCount} resources, ${result.durationMs}ms)`
          );
          validated++;
          return { status: "validated", result };
        } else {
          await database
            .update(servers)
            .set({
              validationStatus: "failed",
              validatedAt: new Date(),
              validationError: result.error,
              validationDurationMs: result.durationMs,
            })
            .where(eq(servers.id, server.id));

          console.log(`❌ ${serverName} - failed: ${result.error?.slice(0, 100)}`);
          failed++;
          return { status: "failed", error: result.error };
        }
      })
    )
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║           Validation Results              ║");
  console.log("╠═══════════════════════════════════════════╣");
  console.log(`║  Duration:      ${duration.padStart(8)}s              ║`);
  console.log(`║  Validated:     ${String(validated).padStart(8)}               ║`);
  console.log(`║  Failed:        ${String(failed).padStart(8)}               ║`);
  console.log(`║  Needs Config:  ${String(needsConfig).padStart(8)}               ║`);
  console.log(`║  Skipped:       ${String(skipped).padStart(8)}               ║`);
  console.log("╚═══════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
