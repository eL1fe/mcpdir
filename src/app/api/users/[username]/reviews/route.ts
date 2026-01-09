import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, reviews, servers } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const params = await context.params;
  const { username } = params;

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  const user = await db.query.users.findFirst({
    where: eq(users.githubUsername, username),
    columns: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        content: reviews.content,
        createdAt: reviews.createdAt,
        server: {
          id: servers.id,
          name: servers.name,
          slug: servers.slug,
        },
      })
      .from(reviews)
      .leftJoin(servers, eq(reviews.serverId, servers.id))
      .where(eq(reviews.userId, user.id))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.userId, user.id)),
  ]);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: Number(totalResult[0]?.count || 0),
      totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / limit),
    },
  });
}
