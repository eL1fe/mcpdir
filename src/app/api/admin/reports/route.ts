import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { reports, users, servers } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

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

  const whereClause = status === "all" ? undefined : eq(reports.status, status);

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: reports.id,
        type: reports.type,
        description: reports.description,
        status: reports.status,
        resolutionNote: reports.resolutionNote,
        createdAt: reports.createdAt,
        resolvedAt: reports.resolvedAt,
        server: {
          id: servers.id,
          name: servers.name,
          slug: servers.slug,
        },
        reporter: {
          id: users.id,
          username: users.githubUsername,
        },
      })
      .from(reports)
      .leftJoin(servers, eq(reports.serverId, servers.id))
      .leftJoin(users, eq(reports.userId, users.id))
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(reports)
      .where(whereClause),
  ]);

  // Get status counts
  const statusCounts = await db
    .select({
      status: reports.status,
      count: count(),
    })
    .from(reports)
    .groupBy(reports.status);

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
      resolved: countsMap["resolved"] || 0,
      dismissed: countsMap["dismissed"] || 0,
      all: Object.values(countsMap).reduce((a, b) => a + b, 0),
    },
  });
}
