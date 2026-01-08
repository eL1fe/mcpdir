#!/usr/bin/env tsx
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Creating users table...");
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      github_id BIGINT UNIQUE NOT NULL,
      github_username VARCHAR(100) NOT NULL,
      email VARCHAR(255),
      avatar_url VARCHAR(500),
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Creating manual_validations table...");
  await sql`
    CREATE TABLE IF NOT EXISTS manual_validations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      install_command VARCHAR(500),
      status VARCHAR(50) DEFAULT 'pending' NOT NULL,
      is_owner_submission INTEGER DEFAULT 0,
      validation_result JSONB,
      validation_error TEXT,
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Creating validation_audit_log table...");
  await sql`
    CREATE TABLE IF NOT EXISTS validation_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id UUID REFERENCES servers(id),
      user_id UUID REFERENCES users(id),
      action VARCHAR(50) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log("Creating indexes...");
  await sql`CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_manual_validations_server_id ON manual_validations(server_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_manual_validations_user_id ON manual_validations(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_manual_validations_status ON manual_validations(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_validation_audit_log_server_id ON validation_audit_log(server_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_validation_audit_log_created_at ON validation_audit_log(created_at DESC)`;

  console.log("Migration complete!");
}

main().catch(console.error);
