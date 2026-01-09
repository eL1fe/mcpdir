import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users, reviews, submissions, servers } from "@/lib/db/schema";
import { eq, count, desc, and } from "drizzle-orm";
import { ProfileHeader, ProfileTabs } from "@/components/profile";
import { SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ username: string }>;
}

async function getUser(username: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.githubUsername, username),
    columns: {
      id: true,
      githubUsername: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!user) return null;

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

  return {
    ...user,
    stats: {
      reviews: Number(reviewsCount[0]?.count || 0),
      submissions: Number(submissionsCount[0]?.count || 0),
      claimedServers: Number(claimedServersCount[0]?.count || 0),
    },
  };
}

async function getUserReviews(userId: string) {
  return db
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
    .limit(20);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await getUser(username);

  if (!user) {
    return {
      title: "User Not Found",
      robots: { index: false },
    };
  }

  const displayName = user.githubUsername;

  return {
    title: `${displayName} — MCP Hub`,
    description: `${displayName}'s profile on MCP Hub. ${user.stats.reviews} reviews, ${user.stats.submissions} submitted servers.`,
    alternates: {
      canonical: `${SITE_URL}/u/${user.githubUsername}`,
    },
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const user = await getUser(username);

  if (!user) {
    notFound();
  }

  const initialReviews = await getUserReviews(user.id);

  return (
    <div className="min-h-screen">
      {/* Header with gradient */}
      <div className="relative overflow-hidden border-b border-[var(--glass-border)]">
        <div className="absolute inset-0 bg-gradient-to-b from-purple/5 via-cyan/3 to-transparent" />
        <div className="container mx-auto px-4 py-8 relative z-10">
          <ProfileHeader user={user} />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <ProfileTabs username={user.githubUsername} initialReviews={initialReviews} />
      </div>
    </div>
  );
}
