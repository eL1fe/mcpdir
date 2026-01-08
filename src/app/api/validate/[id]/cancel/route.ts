import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { manualValidations, validationAuditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  const submission = await db.query.manualValidations.findFirst({
    where: eq(manualValidations.id, id),
  });

  if (!submission) {
    return NextResponse.json({ error: "Validation not found" }, { status: 404 });
  }

  // Only the original submitter can cancel
  if (submission.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the original submitter can cancel" },
      { status: 403 }
    );
  }

  if (submission.status !== "pending" && submission.status !== "validating") {
    return NextResponse.json(
      { error: `Cannot cancel validation in status: ${submission.status}` },
      { status: 400 }
    );
  }

  // Update status to cancelled
  await db
    .update(manualValidations)
    .set({ status: "cancelled" })
    .where(eq(manualValidations.id, id));

  // Log the action
  await db.insert(validationAuditLog).values({
    serverId: submission.serverId,
    userId: session.user.id,
    action: "cancel",
    metadata: {
      validationId: id,
      previousStatus: submission.status,
    },
  });

  return NextResponse.json({
    id,
    status: "cancelled",
    message: "Validation cancelled",
  });
}
