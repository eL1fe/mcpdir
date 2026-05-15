import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviews, servers, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CACHE_CONTROL } from "@/lib/cache";

type RouteContext = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
  const offset = (page - 1) * limit;

  // Find server by slug
  const server = await db.query.servers.findFirst({
    where: eq(servers.slug, slug),
    columns: { id: true, averageRating: true, reviewsCount: true },
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Get reviews with user info
  const serverReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      content: reviews.content,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      user: {
        id: users.id,
        githubUsername: users.githubUsername,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.serverId, server.id))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    reviews: serverReviews,
    averageRating: server.averageRating,
    totalCount: server.reviewsCount,
    page,
    limit,
    hasMore: offset + serverReviews.length < (server.reviewsCount ?? 0),
  }, {
    headers: { "Cache-Control": CACHE_CONTROL.short },
  });
}
