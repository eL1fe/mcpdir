#!/usr/bin/env tsx
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }

  const sql = neon(process.env.DATABASE_URL);

  console.log("Adding workflow columns to manual_validations...");

  // Add columns if they don't exist
  await sql`
    ALTER TABLE manual_validations
    ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT,
    ADD COLUMN IF NOT EXISTS workflow_run_id VARCHAR(100)
  `;

  console.log("✓ Migration complete");
}

main().catch(console.error);
