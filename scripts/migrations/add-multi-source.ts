#!/usr/bin/env tsx
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Running multi-source migration...\n");

  // 1. Add new columns to servers table
  console.log("Adding columns to servers table...");

  await sql`ALTER TABLE servers ADD COLUMN IF NOT EXISTS github_repo_id BIGINT`;
  await sql`ALTER TABLE servers ADD COLUMN IF NOT EXISTS npm_downloads INTEGER`;
  await sql`ALTER TABLE servers ADD COLUMN IF NOT EXISTS npm_quality_score NUMERIC(3,2)`;
  await sql`ALTER TABLE servers ADD COLUMN IF NOT EXISTS discovered_sources JSONB DEFAULT '[]'`;

  console.log("  - github_repo_id BIGINT");
  console.log("  - npm_downloads INTEGER");
  console.log("  - npm_quality_score NUMERIC(3,2)");
  console.log("  - discovered_sources JSONB");

  // 2. Create server_sources table
  console.log("\nCreating server_sources table...");

  await sql`
    CREATE TABLE IF NOT EXISTS server_sources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      source VARCHAR(50) NOT NULL,
      source_identifier VARCHAR(500),
      source_url VARCHAR(500),
      source_data JSONB,
      content_hash VARCHAR(64),
      first_seen_at TIMESTAMP DEFAULT NOW(),
      last_seen_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // 3. Create unique index
  console.log("Creating unique index on server_sources...");

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS server_source_unique
    ON server_sources(server_id, source)
  `;

  // 4. Create index on source for filtering
  await sql`
    CREATE INDEX IF NOT EXISTS idx_server_sources_source
    ON server_sources(source)
  `;

  // 5. Create index on github_repo_id for deduplication
  await sql`
    CREATE INDEX IF NOT EXISTS idx_servers_github_repo_id
    ON servers(github_repo_id)
    WHERE github_repo_id IS NOT NULL
  `;

  // 6. Populate server_sources from existing data (all came from mcp-registry)
  console.log("\nPopulating server_sources from existing servers...");

  const result = await sql`
    INSERT INTO server_sources (server_id, source, source_url, content_hash, first_seen_at, last_seen_at)
    SELECT
      id,
      'mcp-registry',
      source_url,
      content_hash,
      created_at,
      last_synced_at
    FROM servers
    WHERE content_hash IS NOT NULL
    ON CONFLICT (server_id, source) DO NOTHING
    RETURNING id
  `;

  console.log(`  Inserted ${result.length} server_sources records`);

  // 7. Update discovered_sources for existing servers
  console.log("\nUpdating discovered_sources for existing servers...");

  await sql`
    UPDATE servers
    SET discovered_sources = '["mcp-registry"]'::jsonb
    WHERE discovered_sources = '[]'::jsonb OR discovered_sources IS NULL
  `;

  console.log("\nMigration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
