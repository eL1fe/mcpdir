import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { manualValidations } from "@/lib/db/schema";
import { desc, eq, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  // Build query
  let whereClause;
  if (status) {
    whereClause = eq(manualValidations.status, status);
  } else {
    // Default: show pending and validating
    whereClause = or(
      eq(manualValidations.status, "pending"),
      eq(manualValidations.status, "validating")
    );
  }

  const submissions = await db.query.manualValidations.findMany({
    where: whereClause,
    orderBy: [desc(manualValidations.createdAt)],
    limit,
    offset,
    with: {
      server: {
        columns: {
          id: true,
          name: true,
          slug: true,
          packageName: true,
          installCommand: true,
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

  return NextResponse.json({
    data: submissions.map((s) => ({
      id: s.id,
      status: s.status,
      installCommand: s.installCommand,
      isOwnerSubmission: s.isOwnerSubmission === 1,
      createdAt: s.createdAt,
      server: s.server,
      user: {
        username: s.user?.githubUsername,
        avatar: s.user?.avatarUrl,
      },
    })),
    limit,
    offset,
  });
}
