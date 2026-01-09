import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { indexServerFromSubmission } from "@/lib/submission-indexer";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, params.id),
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Only submitter or admin can view
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (submission.userId !== session.user.id && user?.isAdmin !== 1) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json(submission);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Only admin can approve/reject
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (user?.isAdmin !== 1) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { action, rejectionReason } = body as {
    action: "approve" | "reject";
    rejectionReason?: string;
  };

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, params.id),
  });

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "pending") {
    return NextResponse.json(
      { error: `Submission is already ${submission.status}` },
      { status: 400 }
    );
  }

  if (action === "reject") {
    await db
      .update(submissions)
      .set({
        status: "rejected",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, params.id));

    return NextResponse.json({ message: "Submission rejected" });
  }

  // Approve and index the server
  const indexResult = await indexServerFromSubmission({
    githubUrl: submission.githubUrl,
    repoOwner: submission.repoOwner,
    repoName: submission.repoName,
    name: submission.name,
    description: submission.description,
    starsCount: submission.starsCount,
    categoryIds: (submission.categoryIds as string[]) || [],
  });

  if (!indexResult.success) {
    return NextResponse.json(
      { error: `Failed to index server: ${indexResult.error}` },
      { status: 500 }
    );
  }

  // Update submission with server ID
  await db
    .update(submissions)
    .set({
      status: "approved",
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      serverId: indexResult.serverId,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, params.id));

  return NextResponse.json({
    message: "Submission approved and server indexed successfully.",
    server: {
      id: indexResult.serverId,
      slug: indexResult.slug,
    },
  });
}
