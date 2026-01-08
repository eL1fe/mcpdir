#!/usr/bin/env tsx
/**
 * Validation worker script for GitHub Actions
 * Triggered by repository_dispatch with validation_id
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { servers, manualValidations, validationAuditLog } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { decryptCredentials } from "../src/lib/encryption";
import { validateInDocker } from "./lib/docker-validator";

async function main() {
  const validationId = process.env.VALIDATION_ID;

  if (!validationId) {
    console.error("❌ VALIDATION_ID not set");
    process.exit(1);
  }

  console.log(`🔍 Processing validation: ${validationId}`);

  // Fetch validation record
  const validation = await db.query.manualValidations.findFirst({
    where: eq(manualValidations.id, validationId),
  });

  if (!validation) {
    console.error("❌ Validation not found");
    process.exit(1);
  }

  if (validation.status !== "validating") {
    console.error(`❌ Validation status is ${validation.status}, expected 'validating'`);
    process.exit(1);
  }

  // Get server info
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, validation.serverId),
  });

  if (!server) {
    console.error("❌ Server not found");
    await db
      .update(manualValidations)
      .set({
        status: "failed",
        validationError: "Server not found",
        encryptedCredentials: null, // Clear credentials
      })
      .where(eq(manualValidations.id, validationId));
    process.exit(1);
  }

  // Determine install command
  const installCommand = validation.installCommand || server.installCommand;
  if (!installCommand) {
    console.error("❌ No install command");
    await db
      .update(manualValidations)
      .set({
        status: "failed",
        validationError: "No install command available",
        encryptedCredentials: null,
      })
      .where(eq(manualValidations.id, validationId));
    process.exit(1);
  }

  // Decrypt credentials if present
  let credentials: Record<string, string> = {};
  if (validation.encryptedCredentials) {
    try {
      credentials = decryptCredentials(validation.encryptedCredentials);
      console.log(`🔑 Decrypted ${Object.keys(credentials).length} credentials`);
    } catch (err) {
      console.error("❌ Failed to decrypt credentials:", err);
      await db
        .update(manualValidations)
        .set({
          status: "failed",
          validationError: "Failed to decrypt credentials",
          encryptedCredentials: null,
        })
        .where(eq(manualValidations.id, validationId));
      process.exit(1);
    }
  }

  console.log(`🚀 Running validation for: ${server.name}`);
  console.log(`📦 Command: ${installCommand}`);

  // Run Docker validation
  const result = await validateInDocker({
    installCommand,
    envVars: credentials,
  });

  // Clear credentials immediately after use
  await db
    .update(manualValidations)
    .set({ encryptedCredentials: null })
    .where(eq(manualValidations.id, validationId));

  if (result.success) {
    console.log(`✅ Validation successful!`);
    console.log(`   Tools: ${result.tools?.length ?? 0}`);
    console.log(`   Resources: ${result.resources?.length ?? 0}`);
    console.log(`   Prompts: ${result.prompts?.length ?? 0}`);
    console.log(`   Duration: ${result.durationMs}ms`);

    // Update validation record
    await db
      .update(manualValidations)
      .set({
        status: "completed",
        validationResult: result,
      })
      .where(eq(manualValidations.id, validationId));

    // Update server
    await db
      .update(servers)
      .set({
        validationStatus: "validated",
        validatedAt: new Date(),
        validationResult: result,
        validationError: null,
        validationDurationMs: result.durationMs,
        tools: result.tools ?? server.tools,
        resources: result.resources ?? server.resources,
        prompts: result.prompts ?? server.prompts,
      })
      .where(eq(servers.id, validation.serverId));

    // Audit log
    await db.insert(validationAuditLog).values({
      serverId: validation.serverId,
      userId: validation.userId,
      action: "complete",
      metadata: {
        validationId,
        durationMs: result.durationMs,
        toolsCount: result.tools?.length ?? 0,
        source: "github-actions",
      },
    });
  } else {
    console.log(`❌ Validation failed: ${result.error}`);

    // Update validation record
    await db
      .update(manualValidations)
      .set({
        status: "failed",
        validationError: result.error,
      })
      .where(eq(manualValidations.id, validationId));

    // Audit log
    await db.insert(validationAuditLog).values({
      serverId: validation.serverId,
      userId: validation.userId,
      action: "fail",
      metadata: {
        validationId,
        error: result.error,
        durationMs: result.durationMs,
        source: "github-actions",
      },
    });

    // Exit with error so GitHub Action shows as failed
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
