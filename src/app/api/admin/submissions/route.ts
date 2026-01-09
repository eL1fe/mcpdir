import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, users } from "@/lib/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  const devBypass = process.env.NODE_ENV === "development" && process.env.DEV_ADMIN_BYPASS === "true";

  if (!devBypass && !session?.user?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  const whereClause = status === "all" ? undefined : eq(submissions.status, status);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: submissions.id,
        githubUrl: submissions.githubUrl,
        repoOwner: submissions.repoOwner,
        repoName: submissions.repoName,
        name: submissions.name,
        description: submissions.description,
        starsCount: submissions.starsCount,
        categoryIds: submissions.categoryIds,
        status: submissions.status,
        rejectionReason: submissions.rejectionReason,
        createdAt: submissions.createdAt,
        submitter: {
          id: users.id,
          username: users.githubUsername,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(submissions)
      .leftJoin(users, eq(submissions.userId, users.id))
      .where(whereClause)
      .orderBy(desc(submissions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(submissions)
      .where(whereClause),
  ]);

  // Get status counts for tabs
  const statusCounts = await db
    .select({
      status: submissions.status,
      count: count(),
    })
    .from(submissions)
    .groupBy(submissions.status);

  const countsMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countsMap[row.status] = Number(row.count);
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: Number(totalResult[0]?.count || 0),
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    },
    counts: {
      pending: countsMap["pending"] || 0,
      approved: countsMap["approved"] || 0,
      rejected: countsMap["rejected"] || 0,
      all: Object.values(countsMap).reduce((a, b) => a + b, 0),
    },
  });
}
