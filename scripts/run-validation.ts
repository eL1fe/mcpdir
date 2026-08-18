#!/usr/bin/env tsx
/**
 * Validation worker for GitHub Actions.
 * Untrusted MCP packages run on the ephemeral runner; task data and results
 * cross the production app's authenticated HTTPS API instead of PostgreSQL.
 */
import { config } from "dotenv";
import { validateInDocker } from "./lib/docker-validator";
import type { ValidationResult } from "./lib/mcp-validator";

config({ path: ".env.local" });

interface ValidationTask {
  validationId: string;
  serverId: string;
  serverName: string;
  installCommand: string;
  credentials: Record<string, string>;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const workerSecret = requiredEnv("VALIDATION_WORKER_SECRET");

  return fetch(`${appUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function main() {
  const validationId = requiredEnv("VALIDATION_ID");
  const endpoint = `/api/internal/validation/${encodeURIComponent(validationId)}`;

  console.log(`🔍 Fetching validation task ${validationId}`);
  const taskResponse = await workerRequest(endpoint);
  if (!taskResponse.ok) {
    throw new Error(`Failed to fetch task: ${taskResponse.status} ${await taskResponse.text()}`);
  }

  const task = (await taskResponse.json()) as ValidationTask;
  console.log(`🚀 Validating ${task.serverName}`);

  let result: ValidationResult;
  try {
    result = await validateInDocker({
      installCommand: task.installCommand,
      envVars: task.credentials,
    });
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected validation error",
      durationMs: 0,
    };
  }

  const resultResponse = await workerRequest(endpoint, {
    method: "POST",
    body: JSON.stringify({ result }),
  });
  if (!resultResponse.ok) {
    throw new Error(`Failed to report result: ${resultResponse.status} ${await resultResponse.text()}`);
  }

  console.log(result.success ? "✅ Validation completed" : `❌ Validation failed: ${result.error}`);
  if (!result.success) process.exitCode = 1;
}

main().catch((error) => {
  console.error("❌ Validation worker failed:", error);
  process.exit(1);
});
