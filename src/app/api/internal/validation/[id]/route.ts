import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { manualValidations, servers, validationAuditLog } from "@/lib/db/schema";
import { decryptCredentials } from "@/lib/encryption";

export const runtime = "nodejs";

interface ValidationResult {
  success: boolean;
  serverInfo?: { name: string; version?: string };
  capabilities?: { tools?: boolean; resources?: boolean; prompts?: boolean };
  tools?: { name: string; description?: string }[];
  resources?: { uri: string; name?: string; description?: string }[];
  prompts?: { name: string; description?: string }[];
  error?: string;
  durationMs: number;
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.VALIDATION_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(authorization.slice("Bearer ".length));
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isValidationResult(value: unknown): value is ValidationResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<ValidationResult>;
  if (typeof result.success !== "boolean") return false;
  if (!Number.isInteger(result.durationMs) || result.durationMs! < 0 || result.durationMs! > 300_000) {
    return false;
  }
  if (result.error !== undefined && (typeof result.error !== "string" || result.error.length > 2_000)) {
    return false;
  }

  return [result.tools, result.resources, result.prompts].every(
    (items) => items === undefined || (Array.isArray(items) && items.length <= 2_000)
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return unauthorized();

  const { id } = await context.params;
  const validation = await db.query.manualValidations.findFirst({
    where: eq(manualValidations.id, id),
  });
  if (!validation) {
    return NextResponse.json({ error: "Validation not found" }, { status: 404 });
  }
  if (validation.status !== "validating") {
    return NextResponse.json({ error: `Validation is ${validation.status}` }, { status: 409 });
  }

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, validation.serverId),
  });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const installCommand = validation.installCommand || server.installCommand;
  if (!installCommand) {
    return NextResponse.json({ error: "No install command available" }, { status: 409 });
  }

  const credentials = validation.encryptedCredentials
    ? decryptCredentials(validation.encryptedCredentials)
    : {};

  return NextResponse.json(
    {
      validationId: validation.id,
      serverId: server.id,
      serverName: server.name,
      installCommand,
      credentials,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) return unauthorized();

  const { id } = await context.params;
  const body = (await request.json()) as { result?: unknown };
  if (!isValidationResult(body.result)) {
    return NextResponse.json({ error: "Invalid validation result" }, { status: 400 });
  }

  const result = body.result;
  const outcome = await db.transaction(async (tx) => {
    const validation = await tx.query.manualValidations.findFirst({
      where: eq(manualValidations.id, id),
    });
    if (!validation) return { kind: "not-found" as const };
    if (validation.status !== "validating") {
      return { kind: "already-processed" as const, status: validation.status };
    }

    const server = await tx.query.servers.findFirst({
      where: eq(servers.id, validation.serverId),
    });
    if (!server) return { kind: "server-not-found" as const };

    await tx
      .update(manualValidations)
      .set({
        status: result.success ? "completed" : "failed",
        validationResult: result,
        validationError: result.success ? null : result.error || "Validation failed",
        encryptedCredentials: null,
      })
      .where(eq(manualValidations.id, id));

    await tx
      .update(servers)
      .set(
        result.success
          ? {
              validationStatus: "validated",
              validatedAt: new Date(),
              validationResult: result,
              validationError: null,
              validationDurationMs: result.durationMs,
              tools: result.tools ?? server.tools,
              resources: result.resources ?? server.resources,
              prompts: result.prompts ?? server.prompts,
            }
          : {
              validationStatus: "failed",
              validatedAt: new Date(),
              validationResult: result,
              validationError: result.error || "Validation failed",
              validationDurationMs: result.durationMs,
            }
      )
      .where(eq(servers.id, validation.serverId));

    await tx.insert(validationAuditLog).values({
      serverId: validation.serverId,
      userId: validation.userId,
      action: result.success ? "complete" : "fail",
      metadata: {
        validationId: id,
        durationMs: result.durationMs,
        toolsCount: result.tools?.length ?? 0,
        error: result.success ? undefined : result.error,
        source: "github-actions-api",
      },
    });

    return { kind: "updated" as const, status: result.success ? "completed" : "failed" };
  });

  if (outcome.kind === "not-found") {
    return NextResponse.json({ error: "Validation not found" }, { status: 404 });
  }
  if (outcome.kind === "server-not-found") {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: outcome.status,
    alreadyProcessed: outcome.kind === "already-processed",
  });
}
