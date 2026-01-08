import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { manualValidations, servers, validationAuditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();
  const { id } = params;

  // Get the validation submission with related data
  const submission = await db.query.manualValidations.findFirst({
    where: eq(manualValidations.id, id),
    with: {
      server: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        columns: {
          id: true,
          githubUsername: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Validation not found" }, { status: 404 });
  }

  // Public info (anyone can see)
  const publicData = {
    id: submission.id,
    status: submission.status,
    serverId: submission.serverId,
    serverName: submission.server?.name,
    serverSlug: submission.server?.slug,
    createdAt: submission.createdAt,
    isOwnerSubmission: submission.isOwnerSubmission === 1,
  };

  // Additional info for the submitter or admin
  const isSubmitter = session?.user?.id === submission.userId;
  const isAdmin = session?.user?.isAdmin;

  if (isSubmitter || isAdmin) {
    return NextResponse.json({
      ...publicData,
      installCommand: submission.installCommand,
      validationResult: submission.validationResult,
      validationError: submission.validationError,
      reviewedAt: submission.reviewedAt,
      submittedBy: {
        username: submission.user?.githubUsername,
        avatar: submission.user?.avatarUrl,
      },
    });
  }

  return NextResponse.json(publicData);
}

// Admin: Approve or reject a validation submission
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = params;
  const body = await request.json();
  const { action, validationResult, validationError } = body as {
    action: "approve" | "reject" | "complete";
    validationResult?: Record<string, unknown>;
    validationError?: string;
  };

  if (!action || !["approve", "reject", "complete"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject', or 'complete'" },
      { status: 400 }
    );
  }

  const submission = await db.query.manualValidations.findFirst({
    where: eq(manualValidations.id, id),
  });

  if (!submission) {
    return NextResponse.json({ error: "Validation not found" }, { status: 404 });
  }

  // Determine new status
  let newStatus: string;
  if (action === "approve") {
    newStatus = "approved";
  } else if (action === "reject") {
    newStatus = "rejected";
  } else {
    newStatus = validationError ? "failed" : "completed";
  }

  // Update the submission
  await db
    .update(manualValidations)
    .set({
      status: newStatus,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      validationResult: validationResult || submission.validationResult,
      validationError: validationError || submission.validationError,
    })
    .where(eq(manualValidations.id, id));

  // If completed successfully, update the server's validation status
  if (action === "complete" && !validationError) {
    await db
      .update(servers)
      .set({
        validationStatus: "validated",
        validatedAt: new Date(),
        validationResult: validationResult || null,
        validationError: null,
      })
      .where(eq(servers.id, submission.serverId));
  }

  // Log the action
  await db.insert(validationAuditLog).values({
    serverId: submission.serverId,
    userId: session.user.id,
    action,
    metadata: {
      validationId: id,
      previousStatus: submission.status,
      newStatus,
    },
  });

  return NextResponse.json({
    id,
    status: newStatus,
    message: `Validation ${action}${action === "complete" ? "d" : "ed"}`,
  });
}
