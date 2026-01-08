import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { servers, manualValidations, validationAuditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateMcpServerSafe, isDockerAvailable } from "@/lib/validation/docker-validator";
import { encryptCredentials } from "@/lib/encryption";

// Trigger GitHub Actions workflow
async function triggerGitHubActions(validationId: string): Promise<{ success: boolean; runId?: string; error?: string }> {
  const githubToken = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || "mcpdir/mcpdir"; // owner/repo

  if (!githubToken) {
    return { success: false, error: "GITHUB_TOKEN not configured" };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "validate-server",
          client_payload: {
            validation_id: validationId,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `GitHub API error: ${response.status} ${text}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to trigger workflow: ${err}` };
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = params;

  // Get the validation submission
  const submission = await db.query.manualValidations.findFirst({
    where: eq(manualValidations.id, id),
  });

  if (!submission) {
    return NextResponse.json({ error: "Validation not found" }, { status: 404 });
  }

  // Only the original submitter can provide credentials
  if (submission.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the original submitter can provide credentials" },
      { status: 403 }
    );
  }

  if (submission.status !== "pending") {
    return NextResponse.json(
      { error: `Validation is already ${submission.status}` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { credentials } = body as { credentials: Record<string, string> };

  // Sanitize credential values (basic security)
  if (credentials) {
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value !== "string" || value.length > 500) {
        return NextResponse.json(
          { error: `Invalid credential value for ${key}` },
          { status: 400 }
        );
      }
      // No shell metacharacters in values
      if (/[;&|`$]/.test(value)) {
        return NextResponse.json(
          { error: `Credential value for ${key} contains invalid characters` },
          { status: 400 }
        );
      }
    }
  }

  // Get server info
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, submission.serverId),
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Determine install command
  const installCommand = submission.installCommand || server.installCommand;
  if (!installCommand) {
    return NextResponse.json({ error: "No install command available" }, { status: 400 });
  }

  // Update status to indicate validation is in progress
  await db
    .update(manualValidations)
    .set({ status: "validating" })
    .where(eq(manualValidations.id, id));

  // Log the action (without credentials!)
  await db.insert(validationAuditLog).values({
    serverId: submission.serverId,
    userId: session.user.id,
    action: "validate",
    metadata: {
      validationId: id,
      hasCredentials: !!credentials && Object.keys(credentials).length > 0,
    },
  });

  // Check if Docker is available locally
  const dockerAvailable = await isDockerAvailable();

  if (dockerAvailable) {
    // LOCAL MODE: Run validation synchronously with Docker
    const validationResult = await validateMcpServerSafe(installCommand, credentials);

    if (validationResult.success) {
      await db
        .update(manualValidations)
        .set({
          status: "completed",
          validationResult: validationResult,
        })
        .where(eq(manualValidations.id, id));

      await db
        .update(servers)
        .set({
          validationStatus: "validated",
          validatedAt: new Date(),
          validationResult: validationResult,
          validationError: null,
          tools: validationResult.tools ?? server.tools,
          resources: validationResult.resources ?? server.resources,
          prompts: validationResult.prompts ?? server.prompts,
        })
        .where(eq(servers.id, submission.serverId));

      await db.insert(validationAuditLog).values({
        serverId: submission.serverId,
        userId: session.user.id,
        action: "complete",
        metadata: {
          validationId: id,
          durationMs: validationResult.durationMs,
          toolsCount: validationResult.tools?.length ?? 0,
          source: "local-docker",
        },
      });

      return NextResponse.json({
        validationId: id,
        status: "completed",
        message: "Validation successful! Server has been marked as validated.",
        result: {
          serverInfo: validationResult.serverInfo,
          toolsCount: validationResult.tools?.length ?? 0,
          resourcesCount: validationResult.resources?.length ?? 0,
          promptsCount: validationResult.prompts?.length ?? 0,
          durationMs: validationResult.durationMs,
        },
      });
    } else {
      await db
        .update(manualValidations)
        .set({
          status: "failed",
          validationError: validationResult.error,
        })
        .where(eq(manualValidations.id, id));

      await db.insert(validationAuditLog).values({
        serverId: submission.serverId,
        userId: session.user.id,
        action: "fail",
        metadata: {
          validationId: id,
          error: validationResult.error,
          durationMs: validationResult.durationMs,
          source: "local-docker",
        },
      });

      return NextResponse.json({
        validationId: id,
        status: "failed",
        message: "Validation failed",
        error: validationResult.error,
      });
    }
  } else {
    // PRODUCTION MODE: Trigger GitHub Actions workflow
    // Encrypt and store credentials temporarily
    let encryptedCreds: string | null = null;
    if (credentials && Object.keys(credentials).length > 0) {
      try {
        encryptedCreds = encryptCredentials(credentials);
      } catch (err) {
        return NextResponse.json(
          { error: "Failed to encrypt credentials" },
          { status: 500 }
        );
      }
    }

    // Store encrypted credentials and trigger workflow
    await db
      .update(manualValidations)
      .set({
        encryptedCredentials: encryptedCreds,
      })
      .where(eq(manualValidations.id, id));

    const triggerResult = await triggerGitHubActions(id);

    if (!triggerResult.success) {
      // Rollback - clear encrypted credentials
      await db
        .update(manualValidations)
        .set({
          status: "failed",
          encryptedCredentials: null,
          validationError: triggerResult.error,
        })
        .where(eq(manualValidations.id, id));

      return NextResponse.json({
        validationId: id,
        status: "failed",
        message: "Failed to start validation",
        error: triggerResult.error,
      });
    }

    // Return immediately - validation will complete asynchronously
    return NextResponse.json({
      validationId: id,
      status: "validating",
      message: "Validation started. This may take a few minutes.",
      async: true,
    });
  }
}
