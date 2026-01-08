#!/usr/bin/env tsx
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Creating search_queries table...");

  await sql`
    CREATE TABLE IF NOT EXISTS search_queries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      query VARCHAR(500) NOT NULL,
      results_count INTEGER NOT NULL,
      category VARCHAR(100),
      tags VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;

  console.log("Creating indexes...");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_search_queries_created_at
    ON search_queries(created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_search_queries_query
    ON search_queries(query)
  `;

  console.log("✅ Migration complete!");
}

main().catch(console.error);
