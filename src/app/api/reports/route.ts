import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reports, servers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createReportSchema } from "@/lib/validations/user-features";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const result = createReportSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { serverId, type, description } = result.data;

  // Check if server exists
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Check if user already has a pending report for this server
  const existingReport = await db.query.reports.findFirst({
    where: and(
      eq(reports.serverId, serverId),
      eq(reports.userId, session.user.id),
      eq(reports.status, "pending")
    ),
  });

  if (existingReport) {
    return NextResponse.json(
      { error: "You already have a pending report for this server" },
      { status: 409 }
    );
  }

  const [report] = await db
    .insert(reports)
    .values({
      serverId,
      userId: session.user.id,
      type,
      description: description || null,
      status: "pending",
    })
    .returning();

  return NextResponse.json({
    id: report.id,
    message: "Report submitted successfully. Thank you for helping improve the directory.",
  });
}
