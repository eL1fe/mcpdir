import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq, inArray, and } from "drizzle-orm";
import pLimit from "p-limit";
import {
  servers,
  serverSources,
  categories,
  tags,
  serverCategories,
  serverTags,
  manualValidations,
} from "../../src/lib/db/schema";
import { parseServerWithAI, estimateTokens, estimateCost } from "./ai-parser";
import { processReadme, getDefaultBranch } from "./readme-processor";
import { parseGitHubUrl } from "./sources/base";
import { SourceType, DiscoveredServer, SyncSourceOptions } from "./sources/base";
import { getSource, getAllSources } from "./sources";
import { deduplicateServers, groupByCanonicalUrl, MergedServer } from "./deduplication";
import { validateMcpServerSafe } from "./docker-validator";
import { detectRequiresConfig } from "./mcp-validator";

// Lazy initialization of database connection
let db: NeonHttpDatabase | null = null;

function getDb(): NeonHttpDatabase {
  if (!db) {
    const sqlClient = neon(process.env.DATABASE_URL!);
    db = drizzle(sqlClient);
  }
  return db;
}

// Read token at runtime (after dotenv is loaded)
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

// Organizations whose servers are "official"
const OFFICIAL_ORGS = ["modelcontextprotocol", "anthropics"];

// Stars threshold for "popular" tag (verified is now set by validation process)
const POPULAR_STARS_THRESHOLD = 500;

// Global exclusions - repos that are NOT MCP servers (regardless of source)
const GLOBALLY_EXCLUDED_URLS = new Set<string>([
  // Add URLs here if needed, e.g.:
  // "https://github.com/org/repo",
]);

export interface SyncOptions {
  sources?: SourceType[];
  skipAI?: boolean;
  forceRefresh?: boolean;
  retryAIFailed?: boolean;
  concurrency?: number;
  limit?: number; // Limit servers per source (for testing)
  validateNew?: boolean; // Auto-validate new servers
}

export interface SyncResult {
  checked: number;
  updated: number;
  skipped: number;
  errors: number;
  aiParsed: number;
  aiFailed: number;
  aiCost: number;
  sourceStats: Record<SourceType, { fetched: number; filtered: number; errors: number }>;
  merged: number;
  newServers: number;
  validated: number;
  validationFailed: number;
}

// Topic to category mapping
const TOPIC_TO_CATEGORY: Record<string, string> = {
  database: "databases",
  postgresql: "databases",
  postgres: "databases",
  mysql: "databases",
  sqlite: "databases",
  mongodb: "databases",
  redis: "databases",
  supabase: "databases",
  filesystem: "file-systems",
  "file-system": "file-systems",
  files: "file-systems",
  storage: "file-systems",
  s3: "file-systems",
  git: "dev-tools",
  github: "dev-tools",
  docker: "dev-tools",
  terminal: "dev-tools",
  cli: "dev-tools",
  development: "dev-tools",
  devtools: "dev-tools",
  browser: "dev-tools",
  scraper: "dev-tools",
  ai: "ai-ml",
  "machine-learning": "ai-ml",
  ml: "ai-ml",
  llm: "ai-ml",
  embeddings: "ai-ml",
  "vector-database": "ai-ml",
  rag: "ai-ml",
  productivity: "productivity",
  notion: "productivity",
  todoist: "productivity",
  calendar: "productivity",
  notes: "productivity",
  obsidian: "productivity",
  analytics: "data-analytics",
  "data-analysis": "data-analytics",
  bigquery: "data-analytics",
  snowflake: "data-analytics",
  slack: "communication",
  discord: "communication",
  telegram: "communication",
  email: "communication",
  messaging: "communication",
  api: "apis-services",
  rest: "apis-services",
  graphql: "apis-services",
  webhook: "apis-services",
};

// Keyword patterns for categorization
const KEYWORD_TO_CATEGORY: Record<string, string[]> = {
  databases: ["database", "sql", "postgres", "mysql", "sqlite", "mongodb", "redis", "supabase", "neon", "prisma", "drizzle", "db"],
  "file-systems": ["file", "filesystem", "storage", "s3", "blob", "upload", "download", "directory", "folder"],
  "dev-tools": ["git", "github", "gitlab", "docker", "kubernetes", "terminal", "shell", "cli", "code", "ide", "vscode", "debug", "lint", "test", "browser", "scrape", "crawl", "puppeteer", "playwright", "selenium"],
  "ai-ml": ["ai", "ml", "llm", "gpt", "claude", "openai", "anthropic", "embedding", "vector", "rag", "agent", "langchain", "search", "elasticsearch"],
  productivity: ["notion", "obsidian", "todoist", "calendar", "note", "task", "todo", "project", "trello", "asana", "linear"],
  "data-analytics": ["analytics", "data", "bigquery", "snowflake", "tableau", "chart", "dashboard", "report", "metric"],
  communication: ["slack", "discord", "telegram", "email", "chat", "message", "notification", "sms"],
  "apis-services": ["api", "rest", "graphql", "webhook", "http", "fetch", "request", "oauth", "aws", "azure", "gcp", "cloud", "serverless", "lambda", "vercel", "netlify", "sanity", "contentful", "strapi", "wordpress", "cms"],
};

interface GitHubRepo {
  owner: { login: string };
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  pushed_at: string;
  description: string;
  language: string;
  default_branch: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateUniqueSlug(name: string, usedSlugs: Set<string>): string {
  const baseSlug = slugify(name);
  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.add(baseSlug);
    return baseSlug;
  }
  let counter = 2;
  while (usedSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }
  const uniqueSlug = `${baseSlug}-${counter}`;
  usedSlugs.add(uniqueSlug);
  return uniqueSlug;
}

function getCategoriesFromTopics(topics: string[]): string[] {
  const cats = new Set<string>();
  for (const topic of topics) {
    const cat = TOPIC_TO_CATEGORY[topic.toLowerCase()];
    if (cat) cats.add(cat);
  }
  return Array.from(cats);
}

function getCategoriesFromText(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const cats = new Set<string>();

  for (const [category, keywords] of Object.entries(KEYWORD_TO_CATEGORY)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        cats.add(category);
        break;
      }
    }
  }

  return Array.from(cats);
}


interface GitHubRepoResult {
  data: GitHubRepo;
  canonicalUrl: string; // Actual URL after following redirects
  wasRedirected: boolean;
}

async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepoResult | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "mcp-hub-sync",
    };
    const token = getGitHubToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (!response.ok) {
      if (response.status === 403) {
        const remaining = response.headers.get("x-ratelimit-remaining");
        if (remaining === "0") {
          console.warn("GitHub rate limit exceeded");
        }
      }
      return null;
    }

    const data: GitHubRepo = await response.json();

    // Check if repo was renamed/redirected
    const actualOwner = data.owner.login.toLowerCase();
    const actualRepo = (data as unknown as { name: string }).name.toLowerCase();
    const canonicalUrl = `https://github.com/${actualOwner}/${actualRepo}`;
    const wasRedirected = actualOwner !== owner.toLowerCase() || actualRepo !== repo.toLowerCase();

    return { data, canonicalUrl, wasRedirected };
  } catch {
    return null;
  }
}

async function fetchGitHubReadme(owner: string, repo: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "mcp-hub-sync",
    };
    const token = getGitHubToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

// Fetch servers from all specified sources
async function fetchFromSources(
  sources: SourceType[],
  options: SyncSourceOptions
): Promise<{ discovered: DiscoveredServer[]; stats: Record<SourceType, { fetched: number; filtered: number; errors: number }> }> {
  const allDiscovered: DiscoveredServer[] = [];
  const stats: Record<SourceType, { fetched: number; filtered: number; errors: number }> = {} as Record<SourceType, { fetched: number; filtered: number; errors: number }>;

  for (const sourceName of sources) {
    console.log(`\nFetching from ${sourceName}...`);
    const source = getSource(sourceName);
    stats[sourceName] = { fetched: 0, filtered: 0, errors: 0 };

    try {
      for await (const batch of source.fetchServers(options)) {
        allDiscovered.push(...batch.servers);
        stats[sourceName].fetched += batch.stats.fetched;
        stats[sourceName].filtered += batch.stats.filtered;
        stats[sourceName].errors += batch.stats.errors;

        console.log(`  ${sourceName}: ${allDiscovered.filter((s) => s.source === sourceName).length} servers...`);
        // Don't break on hasMore=false - let generator exhaust naturally
        // (some sources have multiple phases, like Glama's API + sitemap)
      }
    } catch (err) {
      console.error(`Error fetching from ${sourceName}:`, err);
      stats[sourceName].errors++;
    }
  }

  return { discovered: allDiscovered, stats };
}

export async function syncServers(options: SyncOptions = {}): Promise<SyncResult> {
  const {
    sources = ["mcp-registry"],
    skipAI = false,
    forceRefresh = false,
    retryAIFailed = false,
    concurrency = 5,
    limit: serverLimit,
    validateNew = false,
  } = options;

  const result: SyncResult = {
    checked: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    aiParsed: 0,
    aiFailed: 0,
    aiCost: 0,
    sourceStats: {} as Record<SourceType, { fetched: number; filtered: number; errors: number }>,
    merged: 0,
    newServers: 0,
    validated: 0,
    validationFailed: 0,
  };

  console.log("Starting multi-source sync...\n");
  console.log(`Sources: ${sources.join(", ")}`);
  console.log(`Options: skipAI=${skipAI}, forceRefresh=${forceRefresh}, retryAIFailed=${retryAIFailed}, concurrency=${concurrency}${serverLimit ? `, limit=${serverLimit}` : ""}\n`);

  // Load categories and tags
  const allCategories = await getDb().select().from(categories);
  const allTags = await getDb().select().from(tags);
  const categoryMap = new Map(allCategories.map((c) => [c.slug, c.id]));
  const tagMap = new Map(allTags.map((t) => [t.slug, t.id]));

  // Fetch from all sources
  const { discovered, stats } = await fetchFromSources(sources, { limit: serverLimit });
  result.sourceStats = stats;

  console.log(`\nTotal discovered: ${discovered.length} servers from ${sources.length} source(s)`);

  // Group by canonical URL and deduplicate
  const grouped = groupByCanonicalUrl(discovered);
  const merged = deduplicateServers(grouped);
  result.merged = merged.length;

  console.log(`After deduplication: ${merged.length} unique servers\n`);

  // Get existing servers for comparison
  const existingServers = await getDb()
    .select({
      id: servers.id,
      slug: servers.slug,
      sourceUrl: servers.sourceUrl,
      contentHash: servers.contentHash,
      readmeContent: servers.readmeContent,
      tools: servers.tools,
    })
    .from(servers);
  const existingByUrl = new Map(existingServers.map((s) => [s.sourceUrl, s]));
  const usedSlugs = new Set(existingServers.map((s) => s.slug));

  // For retry mode, get URLs of servers that have README but empty tools
  const aiFailedUrls = new Set(
    existingServers
      .filter((s) => s.readmeContent && (!s.tools || (Array.isArray(s.tools) && s.tools.length === 0)))
      .map((s) => s.sourceUrl)
  );

  if (retryAIFailed) {
    console.log(`Found ${aiFailedUrls.size} servers with README but no tools (AI failures)\n`);
  }

  // Filter what needs processing
  const toProcess: MergedServer[] = [];

  for (const server of merged) {
    result.checked++;

    // Global exclusion check (repos that are NOT MCP servers)
    if (GLOBALLY_EXCLUDED_URLS.has(server.canonicalUrl)) {
      result.skipped++;
      continue;
    }

    const existing = existingByUrl.get(server.canonicalUrl);

    // In retry mode, only process AI-failed servers
    if (retryAIFailed) {
      if (!aiFailedUrls.has(server.canonicalUrl)) {
        result.skipped++;
        continue;
      }
    } else if (!forceRefresh && existing) {
      // For incremental sync, check if any source data changed
      // Simple heuristic: skip if we've seen this URL before
      // Full content hash comparison would be more accurate
      result.skipped++;
      continue;
    }

    toProcess.push(server);
  }

  console.log(`Need to process: ${toProcess.length} servers (${result.skipped} skipped)\n`);

  if (toProcess.length === 0) {
    console.log("No updates needed!");
    return result;
  }

  // Process servers with rate limiting
  const limiter = pLimit(concurrency);
  let processed = 0;

  const processServer = async (mergedServer: MergedServer) => {
    let { canonicalUrl, githubOwner, githubRepo } = mergedServer;
    const { name: serverName } = mergedServer;

    if (!canonicalUrl) return;

    // Fetch GitHub data if we have owner/repo
    let githubData: GitHubRepo | null = null;
    let readmeContent: string | null = null;

    if (githubOwner && githubRepo) {
      const [repoResult, readme] = await Promise.all([
        fetchGitHubRepo(githubOwner, githubRepo),
        fetchGitHubReadme(githubOwner, githubRepo),
      ]);

      if (repoResult) {
        githubData = repoResult.data;

        // Handle renamed repos - use canonical URL from GitHub
        if (repoResult.wasRedirected) {
          console.log(`  ↪ Redirect: ${canonicalUrl} → ${repoResult.canonicalUrl}`);

          // If the canonical URL already exists, skip this entry (it's a duplicate)
          if (existingByUrl.has(repoResult.canonicalUrl)) {
            console.log(`    Skipping duplicate (canonical entry exists)`);
            result.skipped++;
            return;
          }

          // Update to use the correct canonical URL
          canonicalUrl = repoResult.canonicalUrl;
          const parsed = parseGitHubUrl(canonicalUrl);
          if (parsed) {
            githubOwner = parsed.owner;
            githubRepo = parsed.repo;
          }
        }
      }

      if (readme && githubData) {
        const branch = getDefaultBranch(githubData);
        readmeContent = processReadme(readme, githubOwner, githubRepo, branch);
      }

      await new Promise((r) => setTimeout(r, 50)); // Rate limit
    }

    // Use existing slug for updates, generate unique slug for new servers
    const existingServer = existingByUrl.get(canonicalUrl);
    const slug = existingServer?.slug ?? generateUniqueSlug(serverName, usedSlugs);

    // Parse with AI if enabled and have README
    // Skip AI for existing servers that already have tools (unless retrying failed)
    let aiData = null;
    const hasAIKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY);
    const existingHasTools = existingServer?.tools && Array.isArray(existingServer.tools) && existingServer.tools.length > 0;
    const shouldRunAI = !skipAI && readmeContent && hasAIKey && (!existingHasTools || retryAIFailed);

    if (shouldRunAI) {
      const inputTokens = estimateTokens(readmeContent);
      aiData = await parseServerWithAI(serverName, mergedServer.description || "", readmeContent);
      if (aiData) {
        result.aiParsed++;
        result.aiCost += estimateCost(inputTokens, 500);
      } else {
        result.aiFailed++;
      }
    }

    // Determine tags
    // Note: "verified" tag is now set by validation process, not during sync
    const serverTagSlugs: string[] = [];
    const ownerLower = (githubOwner || "").toLowerCase();

    if (OFFICIAL_ORGS.includes(ownerLower)) {
      serverTagSlugs.push("official");
    } else {
      serverTagSlugs.push("community");
    }

    // Popular tag for high-stars servers (separate from verified status)
    if (mergedServer.stars && mergedServer.stars >= POPULAR_STARS_THRESHOLD) {
      serverTagSlugs.push("popular");
    }

    // Language tag from GitHub data
    const lang = githubData?.language?.toLowerCase();
    if (lang === "typescript" || lang === "javascript") serverTagSlugs.push("typescript");
    else if (lang === "python") serverTagSlugs.push("python");
    else if (lang === "go") serverTagSlugs.push("go");

    // Determine categories
    const githubTopics = githubData?.topics || [];
    const topicCategories = getCategoriesFromTopics(githubTopics);
    const textCategories = getCategoriesFromText(serverName, mergedServer.description || "");
    const aiCategories = aiData?.suggestedCategories || [];

    const allCats = new Set([...topicCategories, ...textCategories]);
    for (const cat of aiCategories) {
      if (categoryMap.has(cat)) allCats.add(cat);
    }
    if (allCats.size === 0) allCats.add("other");

    // Prepare data - merge from multiple sources
    const description = aiData?.enhancedDescription || mergedServer.description || githubData?.description || null;
    const starsCount = mergedServer.stars ?? githubData?.stargazers_count ?? 0;
    const forksCount = mergedServer.forks ?? githubData?.forks_count ?? 0;

    try {
      const isNew = !existingServer;

      // Extract env config schema from Glama if available
      const glamaData = mergedServer.sourceData["glama"] as { environmentVariablesJsonSchema?: Record<string, unknown> } | undefined;
      const envConfigSchema = glamaData?.environmentVariablesJsonSchema || null;

      // Upsert server
      const [inserted] = await getDb()
        .insert(servers)
        .values({
          slug,
          name: serverName,
          description,
          sourceType: "github",
          sourceUrl: canonicalUrl,
          homepageUrl: null,
          packageName: mergedServer.npmPackage || mergedServer.pypiPackage || null,
          packageRegistry: mergedServer.npmPackage ? "npm" : mergedServer.pypiPackage ? "pypi" : null,
          latestVersion: mergedServer.version || null,
          installCommand: mergedServer.installCommand || null,
          readmeContent,
          tools: aiData?.tools || [],
          resources: aiData?.resources || [],
          prompts: aiData?.prompts || [],
          capabilities: {},
          envConfigSchema,
          starsCount,
          forksCount,
          npmDownloads: mergedServer.npmDownloads,
          npmQualityScore: mergedServer.npmQualityScore?.toString(),
          githubRepoId: mergedServer.githubRepoId,
          lastCommitAt: mergedServer.lastUpdatedAt || (githubData?.pushed_at ? new Date(githubData.pushed_at) : null),
          status: "active",
          contentHash: null, // Will compute per-source
          lastSyncedAt: new Date(),
          discoveredSources: mergedServer.sources,
          registryData: mergedServer.sourceData["mcp-registry"] || null,
        })
        .onConflictDoUpdate({
          target: servers.sourceUrl,
          set: {
            name: serverName,
            description,
            readmeContent,
            // Only update AI-extracted fields if we have new AI data
            ...(aiData && {
              tools: aiData.tools || [],
              resources: aiData.resources || [],
              prompts: aiData.prompts || [],
            }),
            envConfigSchema,
            starsCount,
            forksCount,
            npmDownloads: mergedServer.npmDownloads,
            npmQualityScore: mergedServer.npmQualityScore?.toString(),
            githubRepoId: mergedServer.githubRepoId,
            latestVersion: mergedServer.version || null,
            installCommand: mergedServer.installCommand || null,
            lastCommitAt: mergedServer.lastUpdatedAt || (githubData?.pushed_at ? new Date(githubData.pushed_at) : null),
            lastSyncedAt: new Date(),
            discoveredSources: mergedServer.sources,
            registryData: mergedServer.sourceData["mcp-registry"] || null,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Track sources in server_sources table
      for (const source of mergedServer.sources) {
        const sourceData = mergedServer.sourceData[source];
        await getDb()
          .insert(serverSources)
          .values({
            serverId: inserted.id,
            source,
            sourceData,
            lastSeenAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [serverSources.serverId, serverSources.source],
            set: {
              sourceData,
              lastSeenAt: new Date(),
            },
          });
      }

      // Clear old relations
      await getDb().delete(serverCategories).where(eq(serverCategories.serverId, inserted.id));
      await getDb().delete(serverTags).where(eq(serverTags.serverId, inserted.id));

      // Link categories
      for (const catSlug of allCats) {
        const catId = categoryMap.get(catSlug);
        if (catId) {
          await getDb().insert(serverCategories).values({ serverId: inserted.id, categoryId: catId }).onConflictDoNothing();
        }
      }

      // Link tags
      for (const tagSlug of serverTagSlugs) {
        const tagId = tagMap.get(tagSlug);
        if (tagId) {
          await getDb().insert(serverTags).values({ serverId: inserted.id, tagId }).onConflictDoNothing();
        }
      }

      result.updated++;
      if (isNew) result.newServers++;

      // Queue re-validation if version changed on a validated server
      if (
        !isNew &&
        existingServer &&
        existingServer.validationStatus === "validated" &&
        mergedServer.version &&
        existingServer.latestVersion &&
        existingServer.latestVersion !== mergedServer.version
      ) {
        console.log(
          `  Version changed: ${existingServer.latestVersion} → ${mergedServer.version}, queuing re-validation`
        );
        await getDb()
          .insert(manualValidations)
          .values({
            serverId: inserted.id,
            userId: null, // System-triggered
            installCommand: inserted.installCommand,
            status: "pending",
            isOwnerSubmission: 0,
          })
          .onConflictDoNothing(); // Avoid duplicates
      }

      // Auto-validate new servers if enabled
      if (isNew && validateNew && inserted.installCommand) {
        // Check if server requires config (skip those)
        if (readmeContent && detectRequiresConfig(readmeContent)) {
          await getDb()
            .update(servers)
            .set({
              validationStatus: "needs_config",
              validationError: "Requires API keys or configuration",
              validatedAt: new Date(),
            })
            .where(eq(servers.id, inserted.id));
        } else {
          console.log(`  Validating ${serverName}...`);
          const validationResult = await validateMcpServerSafe(inserted.installCommand);

          if (validationResult.success) {
            await getDb()
              .update(servers)
              .set({
                validationStatus: "validated",
                validatedAt: new Date(),
                validationResult: validationResult,
                validationDurationMs: validationResult.durationMs,
                validationError: null,
                ...(validationResult.tools && validationResult.tools.length > 0
                  ? { tools: validationResult.tools }
                  : {}),
                ...(validationResult.resources && validationResult.resources.length > 0
                  ? { resources: validationResult.resources }
                  : {}),
                ...(validationResult.prompts && validationResult.prompts.length > 0
                  ? { prompts: validationResult.prompts }
                  : {}),
              })
              .where(eq(servers.id, inserted.id));
            result.validated++;
            console.log(`  ✅ ${serverName} validated (${validationResult.tools?.length || 0} tools)`);
          } else {
            await getDb()
              .update(servers)
              .set({
                validationStatus: "failed",
                validatedAt: new Date(),
                validationError: validationResult.error,
                validationDurationMs: validationResult.durationMs,
              })
              .where(eq(servers.id, inserted.id));
            result.validationFailed++;
          }
        }
      }
    } catch (err) {
      console.error(`Error processing ${serverName}:`, err);
      result.errors++;
    }

    processed++;
    if (processed % 25 === 0 || processed === toProcess.length) {
      console.log(`Processed ${processed}/${toProcess.length} servers...`);
    }
  };

  await Promise.all(toProcess.map((item) => limiter(() => processServer(item))));

  return result;
}
