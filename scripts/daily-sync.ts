#!/usr/bin/env npx tsx

/**
 * Daily Sync Script (for cron)
 *
 * Incremental sync:
 * - New servers: full pipeline (sync + AI + enrich + validate)
 * - Existing servers: update metadata only
 *
 * Usage:
 *   pnpm sync:daily
 *
 * Cron example (daily at 3am):
 *   0 3 * * * cd /path/to/mcpdir && pnpm sync:daily >> /var/log/mcpdir-sync.log 2>&1
 */

import { execSync, spawn } from "child_process";

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function runCommand(cmd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    log(`Running: ${cmd}`);

    let output = "";
    const child = spawn(cmd, {
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    child.stdout?.on("data", (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      output += data.toString();
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      resolve({ success: code === 0, output });
    });

    child.on("error", (err) => {
      resolve({ success: false, output: err.message });
    });
  });
}

async function main() {
  const startTime = Date.now();
  log("=== Daily Sync Started ===");

  // Step 1: Sync from all sources (incremental - skips unchanged)
  log("\n--- Step 1: Syncing from all sources ---");
  const syncResult = await runCommand("pnpm sync:all");

  // Parse new servers count from output
  const newServersMatch = syncResult.output.match(/New servers: (\d+)/);
  const newServers = newServersMatch ? parseInt(newServersMatch[1]) : 0;

  log(`New servers found: ${newServers}`);

  // Step 2: Enrich from Glama (updates existing)
  log("\n--- Step 2: Enriching from Glama ---");
  await runCommand("pnpm enrich:glama --integrations=100");

  // Step 3: Validate new servers (if any)
  if (newServers > 0) {
    log("\n--- Step 3: Validating new servers ---");
    // Validate servers added in last 24h
    await runCommand("pnpm validate -- --recent=24h");
  } else {
    log("\n--- Step 3: No new servers, skipping validation ---");
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  log(`\n=== Daily Sync Complete (${duration} min) ===`);
}

main().catch((err) => {
  console.error("Daily sync failed:", err);
  process.exit(1);
});
