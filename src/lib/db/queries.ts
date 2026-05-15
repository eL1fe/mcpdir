import { db } from ".";
import { servers, categories, tags, serverCategories, serverTags } from "./schema";
import { eq, desc, asc, sql, and } from "drizzle-orm";

export type SortOption = "stars" | "updated" | "name" | "relevance";
export type SortOrder = "asc" | "desc";

type ListSortOption = "stars" | "updated" | "name";

const serverListColumns = {
  id: servers.id,
  slug: servers.slug,
  name: servers.name,
  description: servers.description,
  sourceType: servers.sourceType,
  sourceUrl: servers.sourceUrl,
  homepageUrl: servers.homepageUrl,
  packageName: servers.packageName,
  packageRegistry: servers.packageRegistry,
  latestVersion: servers.latestVersion,
  installCommand: servers.installCommand,
  tools: servers.tools,
  resources: servers.resources,
  prompts: servers.prompts,
  capabilities: servers.capabilities,
  starsCount: servers.starsCount,
  forksCount: servers.forksCount,
  lastCommitAt: servers.lastCommitAt,
  status: servers.status,
  contentHash: servers.contentHash,
  lastSyncedAt: servers.lastSyncedAt,
  validatedAt: servers.validatedAt,
  validationStatus: servers.validationStatus,
  validationDurationMs: servers.validationDurationMs,
  discoveredSources: servers.discoveredSources,
  npmDownloads: servers.npmDownloads,
  averageRating: servers.averageRating,
  reviewsCount: servers.reviewsCount,
  createdAt: servers.createdAt,
  updatedAt: servers.updatedAt,
};

function withListDefaults<T extends Record<string, unknown>>(server: T) {
  return {
    ...server,
    readmeContent: null,
    registryData: null,
    validationResult: null,
    validationError: null,
    githubRepoId: null,
    npmQualityScore: null,
    envConfigSchema: null,
    glamaSlug: null,
    glamaQualityScore: null,
    glamaSecurityScore: null,
    glamaLicenseScore: null,
    supportedPlatforms: null,
    glamaEnrichedAt: null,
    claimedBy: null,
    claimedAt: null,
  };
}

interface GetServersOptions {
  categorySlug?: string;
  tagSlugs?: string[];
  sort?: ListSortOption;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export async function getServers(options: GetServersOptions = {}) {
  const { categorySlug, tagSlugs, sort = "stars", order = "desc", page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const sortColumn = {
    stars: servers.starsCount,
    updated: servers.updatedAt,
    name: servers.name,
  }[sort];

  const orderFn = order === "desc" ? desc : asc;

  const conditions = [eq(servers.status, "active")];

  if (categorySlug) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM server_categories sc JOIN categories c ON sc.category_id = c.id WHERE sc.server_id = ${servers.id} AND c.slug = ${categorySlug})`
    );
  }

  if (tagSlugs?.length) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM server_tags st JOIN tags t ON st.tag_id = t.id WHERE st.server_id = ${servers.id} AND t.slug = ANY(${tagSlugs}::text[]))`
    );
  }

  const results = await db
    .select({
      server: serverListColumns,
      categories: sql<string[]>`array_agg(DISTINCT ${categories.slug})`.as("categories"),
      tags: sql<string[]>`array_agg(DISTINCT ${tags.slug})`.as("tags"),
    })
    .from(servers)
    .leftJoin(serverCategories, eq(servers.id, serverCategories.serverId))
    .leftJoin(categories, eq(serverCategories.categoryId, categories.id))
    .leftJoin(serverTags, eq(servers.id, serverTags.serverId))
    .leftJoin(tags, eq(serverTags.tagId, tags.id))
    .where(and(...conditions))
    .groupBy(servers.id)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  return results.map((r) => ({
    ...withListDefaults(r.server),
    categories: r.categories?.filter(Boolean) ?? [],
    tags: r.tags?.filter(Boolean) ?? [],
  }));
}

export async function getServerBySlug(slug: string) {
  const result = await db
    .select({
      server: servers,
      categories: sql<string[]>`array_agg(DISTINCT ${categories.slug})`.as("categories"),
      categoryNames: sql<string[]>`array_agg(DISTINCT ${categories.name})`.as("categoryNames"),
      tags: sql<string[]>`array_agg(DISTINCT ${tags.slug})`.as("tags"),
      tagNames: sql<string[]>`array_agg(DISTINCT ${tags.name})`.as("tagNames"),
      claimedByUsername: sql<string | null>`(SELECT github_username FROM users WHERE id = ${servers.claimedBy} LIMIT 1)`.as("claimedByUsername"),
    })
    .from(servers)
    .leftJoin(serverCategories, eq(servers.id, serverCategories.serverId))
    .leftJoin(categories, eq(serverCategories.categoryId, categories.id))
    .leftJoin(serverTags, eq(servers.id, serverTags.serverId))
    .leftJoin(tags, eq(serverTags.tagId, tags.id))
    .where(eq(servers.slug, slug))
    .groupBy(servers.id)
    .limit(1);

  if (!result.length) return null;

  const r = result[0];
  return {
    ...r.server,
    categories: r.categories?.filter(Boolean) ?? [],
    categoryNames: r.categoryNames?.filter(Boolean) ?? [],
    tags: r.tags?.filter(Boolean) ?? [],
    tagNames: r.tagNames?.filter(Boolean) ?? [],
    claimedByUsername: r.claimedByUsername,
  };
}

export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.displayOrder));
}

export async function getCategoryBySlug(slug: string) {
  const result = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function getTags() {
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function getStats() {
  const [serverCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(servers)
    .where(eq(servers.status, "active"));

  const [categoryCount] = await db.select({ count: sql<number>`count(*)::int` }).from(categories);

  const [totalStars] = await db
    .select({ sum: sql<number>`coalesce(sum(${servers.starsCount}), 0)::int` })
    .from(servers)
    .where(eq(servers.status, "active"));

  const [validatedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(servers)
    .where(and(eq(servers.status, "active"), eq(servers.validationStatus, "validated")));

  return {
    servers: serverCount?.count ?? 0,
    categories: categoryCount?.count ?? 0,
    totalStars: totalStars?.sum ?? 0,
    validated: validatedCount?.count ?? 0,
  };
}

export async function getServersByCategory(categorySlug: string, limit = 20, page = 1) {
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return { servers: [], total: 0 };

  const offset = (page - 1) * limit;

  const [serverList, countResult] = await Promise.all([
    db
      .select({ server: serverListColumns })
      .from(servers)
      .innerJoin(serverCategories, eq(servers.id, serverCategories.serverId))
      .where(and(eq(servers.status, "active"), eq(serverCategories.categoryId, category.id)))
      .orderBy(desc(servers.starsCount))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(servers)
      .innerJoin(serverCategories, eq(servers.id, serverCategories.serverId))
      .where(and(eq(servers.status, "active"), eq(serverCategories.categoryId, category.id))),
  ]);

  return {
    servers: serverList.map((r) => withListDefaults(r.server)),
    total: countResult[0]?.count ?? 0,
  };
}

interface SearchServersOptions {
  query?: string;
  categorySlug?: string;
  tagSlugs?: string[];
  sort?: SortOption;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export async function searchServers(options: SearchServersOptions = {}) {
  const normalizedQuery = options.query?.trim();
  const searchQuery = normalizedQuery && normalizedQuery.length >= 2 ? normalizedQuery : undefined;
  const {
    categorySlug,
    tagSlugs,
    sort = searchQuery ? "relevance" : "stars",
    order = "desc",
    page = 1,
    limit = 20,
  } = options;
  const offset = (page - 1) * limit;

  // Build dynamic SQL parts
  const chunks: ReturnType<typeof sql>[] = [];

  // Base SELECT
  chunks.push(sql`
    SELECT
      s.id,
      s.slug,
      s.name,
      s.description,
      s.source_type,
      s.source_url,
      s.homepage_url,
      s.package_name,
      s.package_registry,
      s.latest_version,
      s.install_command,
      s.tools,
      s.resources,
      s.prompts,
      s.capabilities,
      s.stars_count,
      s.forks_count,
      s.last_commit_at,
      s.status,
      s.content_hash,
      s.last_synced_at,
      s.validated_at,
      s.validation_status,
      s.validation_duration_ms,
      s.discovered_sources,
      s.npm_downloads,
      s.average_rating,
      s.reviews_count,
      s.created_at,
      s.updated_at,
      array_agg(DISTINCT c.slug) FILTER (WHERE c.slug IS NOT NULL) as categories,
      array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL) as tags
  `);

  if (searchQuery) {
    chunks.push(sql`, ts_rank(s.search_vector, plainto_tsquery('english', ${searchQuery})) as relevance`);
  }

  // FROM and JOINs
  chunks.push(sql`
    FROM servers s
    LEFT JOIN server_categories sc ON s.id = sc.server_id
    LEFT JOIN categories c ON sc.category_id = c.id
    LEFT JOIN server_tags st ON s.id = st.server_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE s.status = 'active'
  `);

  // Search condition (hybrid: FTS + trigram for substring matching)
  if (searchQuery) {
    const q = searchQuery;
    chunks.push(sql` AND (
      s.search_vector @@ plainto_tsquery('english', ${q})
      OR s.name ILIKE ${'%' + q + '%'}
      OR s.package_name ILIKE ${'%' + q + '%'}
    )`);
  }

  // Category filter
  if (categorySlug) {
    chunks.push(sql` AND EXISTS (
      SELECT 1 FROM server_categories sc2
      JOIN categories c2 ON sc2.category_id = c2.id
      WHERE sc2.server_id = s.id AND c2.slug = ${categorySlug}
    )`);
  }

  // Tag filter
  if (tagSlugs?.length) {
    chunks.push(sql` AND EXISTS (
      SELECT 1 FROM server_tags st2
      JOIN tags t2 ON st2.tag_id = t2.id
      WHERE st2.server_id = s.id AND t2.slug = ANY(${tagSlugs}::text[])
    )`);
  }

  // GROUP BY
  chunks.push(sql` GROUP BY s.id`);

  // ORDER BY
  if (sort === "relevance" && searchQuery) {
    if (order === "asc") {
      chunks.push(sql` ORDER BY relevance ASC, s.stars_count DESC`);
    } else {
      chunks.push(sql` ORDER BY relevance DESC, s.stars_count DESC`);
    }
  } else if (sort === "stars") {
    chunks.push(order === "asc" ? sql` ORDER BY s.stars_count ASC NULLS LAST` : sql` ORDER BY s.stars_count DESC NULLS LAST`);
  } else if (sort === "updated") {
    chunks.push(order === "asc" ? sql` ORDER BY s.updated_at ASC NULLS LAST` : sql` ORDER BY s.updated_at DESC NULLS LAST`);
  } else {
    chunks.push(order === "asc" ? sql` ORDER BY s.name ASC` : sql` ORDER BY s.name DESC`);
  }

  // LIMIT/OFFSET
  chunks.push(sql` LIMIT ${limit} OFFSET ${offset}`);

  // Combine chunks
  const finalQuery = sql.join(chunks, sql``);
  const results = await db.execute(finalQuery);

  // Count query
  const countChunks: ReturnType<typeof sql>[] = [
    sql`SELECT COUNT(DISTINCT s.id)::int as total FROM servers s WHERE s.status = 'active'`,
  ];

  if (searchQuery) {
    const q = searchQuery;
    countChunks.push(sql` AND (
      s.search_vector @@ plainto_tsquery('english', ${q})
      OR s.name ILIKE ${'%' + q + '%'}
      OR s.package_name ILIKE ${'%' + q + '%'}
    )`);
  }

  if (categorySlug) {
    countChunks.push(sql` AND EXISTS (
      SELECT 1 FROM server_categories sc2
      JOIN categories c2 ON sc2.category_id = c2.id
      WHERE sc2.server_id = s.id AND c2.slug = ${categorySlug}
    )`);
  }

  if (tagSlugs?.length) {
    countChunks.push(sql` AND EXISTS (
      SELECT 1 FROM server_tags st2
      JOIN tags t2 ON st2.tag_id = t2.id
      WHERE st2.server_id = s.id AND t2.slug = ANY(${tagSlugs}::text[])
    )`);
  }

  const countQuery = sql.join(countChunks, sql``);
  const countResult = await db.execute(countQuery);
  const total = (countResult.rows[0] as { total: number })?.total ?? 0;

  return {
    servers: results.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      description: row.description as string | null,
      sourceType: row.source_type as string,
      sourceUrl: row.source_url as string,
      homepageUrl: row.homepage_url as string | null,
      packageName: row.package_name as string | null,
      packageRegistry: row.package_registry as string | null,
      latestVersion: row.latest_version as string | null,
      readmeContent: null,
      installCommand: row.install_command as string | null,
      tools: row.tools as { name: string; description?: string }[],
      resources: row.resources as { uri: string; name?: string; description?: string }[],
      prompts: row.prompts as { name: string; description?: string }[],
      capabilities: row.capabilities as Record<string, boolean>,
      starsCount: row.stars_count as number | null,
      forksCount: row.forks_count as number | null,
      lastCommitAt: row.last_commit_at as Date | null,
      status: row.status as string,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
      contentHash: row.content_hash as string | null,
      lastSyncedAt: row.last_synced_at as Date | null,
      registryData: null,
      validatedAt: row.validated_at as Date | null,
      validationStatus: row.validation_status as string | null,
      validationResult: null,
      validationError: null,
      validationDurationMs: row.validation_duration_ms as number | null,
      discoveredSources: row.discovered_sources as string[] | null,
      npmDownloads: row.npm_downloads as number | null,
      averageRating: row.average_rating as string | null,
      reviewsCount: row.reviews_count as number | null,
      categories: (row.categories as string[] | null) ?? [],
      tags: (row.tags as string[] | null) ?? [],
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export interface ServerPreview {
  slug: string;
  name: string;
  description: string | null;
  starsCount: number | null;
}

export async function searchServersPreview(query: string, limit = 3): Promise<ServerPreview[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // Keep typeahead cheap: FTS plus small text columns, no README/description scans.
  const results = await db.execute(sql`
    SELECT slug, name, description, stars_count
    FROM servers
    WHERE status = 'active' AND (
      search_vector @@ plainto_tsquery('english', ${q})
      OR name ILIKE ${'%' + q + '%'}
      OR package_name ILIKE ${'%' + q + '%'}
    )
    ORDER BY
      CASE WHEN name ILIKE ${q + '%'} THEN 0 ELSE 1 END,
      CASE WHEN search_vector @@ plainto_tsquery('english', ${q})
           THEN ts_rank(search_vector, plainto_tsquery('english', ${q}))
           ELSE 0 END DESC,
      stars_count DESC NULLS LAST
    LIMIT ${limit}
  `);

  return results.rows.map((row: Record<string, unknown>) => ({
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | null,
    starsCount: row.stars_count as number | null,
  }));
}

// ============================================================================
// Search Analytics
// ============================================================================

export async function trackSearch(data: {
  query: string;
  resultsCount: number;
  category?: string;
  tags?: string;
}) {
  if (!data.query || data.query.length < 2) return;

  try {
    const { getSql } = await import(".");
    const sql = getSql();
    await sql`
      INSERT INTO search_queries (query, results_count, category, tags)
      VALUES (${data.query.slice(0, 500)}, ${data.resultsCount}, ${data.category ?? null}, ${data.tags ?? null})
    `;
  } catch {
    // Silently fail - analytics shouldn't break search
  }
}

export async function getPopularSearches(limit = 10) {
  const { getSql } = await import(".");
  const sql = getSql();
  const results = await sql`
    SELECT query, COUNT(*) as count
    FROM search_queries
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND results_count > 0
    GROUP BY query
    ORDER BY count DESC
    LIMIT ${limit}
  `;
  return results as { query: string; count: number }[];
}

// ============================================================================
// Popular Servers (for No Results suggestions)
// ============================================================================

export async function getPopularServers(limit = 6) {
  const results = await db
    .select({
      server: serverListColumns,
      categories: sql<string[]>`array_agg(DISTINCT ${categories.slug})`.as("categories"),
      tags: sql<string[]>`array_agg(DISTINCT ${tags.slug})`.as("tags"),
    })
    .from(servers)
    .leftJoin(serverCategories, eq(servers.id, serverCategories.serverId))
    .leftJoin(categories, eq(serverCategories.categoryId, categories.id))
    .leftJoin(serverTags, eq(servers.id, serverTags.serverId))
    .leftJoin(tags, eq(serverTags.tagId, tags.id))
    .where(eq(servers.status, "active"))
    .groupBy(servers.id)
    .orderBy(desc(servers.starsCount))
    .limit(limit);

  return results.map((r) => ({
    ...withListDefaults(r.server),
    categories: r.categories?.filter(Boolean) || [],
    tags: r.tags?.filter(Boolean) || [],
  }));
}

export async function getServerOgBySlug(slug: string) {
  const result = await db
    .select({
      name: servers.name,
      description: servers.description,
      tools: servers.tools,
      starsCount: servers.starsCount,
      validationStatus: servers.validationStatus,
    })
    .from(servers)
    .where(eq(servers.slug, slug))
    .limit(1);

  return result[0] ?? null;
}
