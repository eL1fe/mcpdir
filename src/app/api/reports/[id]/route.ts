import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reports, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Only admin can resolve/dismiss reports
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (user?.isAdmin !== 1) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { action, resolutionNote } = body as {
    action: "resolve" | "dismiss";
    resolutionNote?: string;
  };

  if (!["resolve", "dismiss"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, params.id),
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (report.status !== "pending") {
    return NextResponse.json(
      { error: `Report is already ${report.status}` },
      { status: 400 }
    );
  }

  await db
    .update(reports)
    .set({
      status: action === "resolve" ? "resolved" : "dismissed",
      resolvedBy: session.user.id,
      resolvedAt: new Date(),
      resolutionNote: resolutionNote || null,
    })
    .where(eq(reports.id, params.id));

  return NextResponse.json({
    message: `Report ${action === "resolve" ? "resolved" : "dismissed"} successfully`,
  });
}
