import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { servers, categories } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SITEMAP_SERVER_LIMIT = Math.max(
  100,
  Math.min(Number(process.env.SITEMAP_SERVER_LIMIT ?? 2000), 5000)
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/servers`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const allServers = await db
    .select({
      slug: servers.slug,
      updatedAt: servers.updatedAt,
      starsCount: servers.starsCount,
    })
    .from(servers)
    .where(eq(servers.status, "active"))
    .orderBy(desc(servers.starsCount))
    .limit(SITEMAP_SERVER_LIMIT);

  const serverPages: MetadataRoute.Sitemap = allServers.map((server) => ({
    url: `${SITE_URL}/servers/${server.slug}`,
    lastModified: server.updatedAt || new Date(),
    changeFrequency: "weekly" as const,
    priority: Math.min(0.8, 0.5 + (server.starsCount || 0) / 10000),
  }));

  const allCategories = await db.select({ slug: categories.slug }).from(categories);

  const categoryPages: MetadataRoute.Sitemap = allCategories.map((cat) => ({
    url: `${SITE_URL}/categories/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...serverPages];
}
