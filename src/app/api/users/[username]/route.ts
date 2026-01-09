import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, reviews, submissions, servers, serverClaims } from "@/lib/db/schema";
import { eq, count, desc, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const params = await context.params;
  const { username } = params;

  const user = await db.query.users.findFirst({
    where: eq(users.githubUsername, username),
    columns: {
      id: true,
      githubUsername: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user stats
  const [reviewsCount, submissionsCount, claimedServersCount] = await Promise.all([
    db.select({ count: count() }).from(reviews).where(eq(reviews.userId, user.id)),
    db
      .select({ count: count() })
      .from(submissions)
      .where(and(eq(submissions.userId, user.id), eq(submissions.status, "approved"))),
    db
      .select({ count: count() })
      .from(servers)
      .where(eq(servers.claimedBy, user.id)),
  ]);

  return NextResponse.json({
    ...user,
    stats: {
      reviews: Number(reviewsCount[0]?.count || 0),
      submissions: Number(submissionsCount[0]?.count || 0),
      claimedServers: Number(claimedServersCount[0]?.count || 0),
    },
  });
}

// Get user's reviews
export async function getUserReviews(userId: string, page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const data = await db
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
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);

  return data;
}
