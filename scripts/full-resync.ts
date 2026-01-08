#!/usr/bin/env npx tsx

/**
 * Full Resync Pipeline
 *
 * Complete clean sync of all MCP servers:
 * 1. Truncate servers table (clean slate)
 * 2. Sync from all sources (registry, npm, github, glama)
 * 3. AI parsing for all READMEs
 * 4. Enrich from Glama integration pages
 * 5. Validate all servers
 *
 * Usage:
 *   pnpm resync              # Full resync (interactive confirmation)
 *   pnpm resync --yes        # Skip confirmation
 *   pnpm resync --skip-ai    # Skip AI parsing (faster)
 *   pnpm resync --skip-validate # Skip validation
 */

import { execSync, spawn } from "child_process";
import * as readline from "readline";

const STEPS = [
  { name: "truncate", desc: "Truncate servers table", cmd: null },
  { name: "sync", desc: "Sync from all sources", cmd: "pnpm sync:all" },
  { name: "enrich", desc: "Enrich from Glama", cmd: "pnpm enrich:glama" },
  { name: "validate", desc: "Validate all servers", cmd: "pnpm validate --limit=10000" },
];

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

function runCommand(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${cmd}\n`);

    const child = spawn(cmd, {
      shell: true,
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });

    child.on("error", reject);
  });
}

async function truncateServers(): Promise<void> {
  console.log("\n🗑️  Truncating servers table...\n");

  // Use drizzle to truncate
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { sql } = await import("drizzle-orm");

  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle(sqlClient);

  // Truncate in correct order (respecting foreign keys)
  await db.execute(sql`TRUNCATE server_categories, server_tags, server_sources, manual_validations CASCADE`);
  await db.execute(sql`TRUNCATE servers CASCADE`);

  console.log("✅ Servers table truncated\n");
}

async function main() {
  const args = process.argv.slice(2);
  const skipConfirm = args.includes("--yes") || args.includes("-y");
  const skipAI = args.includes("--skip-ai");
  const skipValidate = args.includes("--skip-validate");
  const skipEnrich = args.includes("--skip-enrich");

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🔄 FULL RESYNC PIPELINE                   ║
╠══════════════════════════════════════════════════════════════╣
║  This will:                                                  ║
║  1. DELETE all servers from database                         ║
║  2. Re-sync from: MCP Registry, npm, GitHub, Glama           ║
║  3. Parse all READMEs with AI ${skipAI ? "(SKIPPED)" : ""}                           ║
║  4. Enrich with Glama scores ${skipEnrich ? "(SKIPPED)" : ""}                         ║
║  5. Validate servers ${skipValidate ? "(SKIPPED)" : ""}                                ║
╚══════════════════════════════════════════════════════════════╝
`);

  if (!skipConfirm) {
    const proceed = await confirm("⚠️  This will DELETE all existing servers. Continue?");
    if (!proceed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  const startTime = Date.now();

  try {
    // Step 1: Truncate
    await truncateServers();

    // Step 2: Sync from all sources
    console.log("\n📡 Step 2/4: Syncing from all sources...\n");
    const syncCmd = skipAI ? "SKIP_AI=true pnpm sync:all" : "pnpm sync:all";
    await runCommand(syncCmd);

    // Step 3: Enrich from Glama
    if (!skipEnrich) {
      console.log("\n✨ Step 3/4: Enriching from Glama...\n");
      await runCommand("pnpm enrich:glama");
    } else {
      console.log("\n⏭️  Step 3/4: Skipping Glama enrichment\n");
    }

    // Step 4: Validate
    if (!skipValidate) {
      console.log("\n🔍 Step 4/4: Validating all servers...\n");
      await runCommand("pnpm validate --limit=10000");
    } else {
      console.log("\n⏭️  Step 4/4: Skipping validation\n");
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     ✅ RESYNC COMPLETE                       ║
╠══════════════════════════════════════════════════════════════╣
║  Duration: ${duration} minutes                                       ║
╚══════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    console.error("\n❌ Resync failed:", error);
    process.exit(1);
  }
}

main();
