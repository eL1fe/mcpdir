import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { manualValidations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ submission: null });
  }

  const searchParams = request.nextUrl.searchParams;
  const serverId = searchParams.get("serverId");

  if (!serverId) {
    return NextResponse.json({ error: "serverId required" }, { status: 400 });
  }

  // Find most recent submission (any status except cancelled)
  const submission = await db.query.manualValidations.findFirst({
    where: and(
      eq(manualValidations.serverId, serverId),
      eq(manualValidations.userId, session.user.id)
    ),
    columns: {
      id: true,
      status: true,
      createdAt: true,
      validationError: true,
    },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });

  // Skip cancelled submissions
  if (submission?.status === "cancelled") {
    return NextResponse.json({ submission: null });
  }

  return NextResponse.json({ submission: submission || null });
}
