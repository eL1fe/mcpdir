import { SyncSource, DiscoveredServer, SyncSourceOptions, SyncBatch, normalizeGitHubUrl, parseGitHubUrl, delay } from "./base";
import { jsonrepair } from "jsonrepair";

const GLAMA_API_URL = "https://glama.ai/api/mcp/v1/servers";
const GLAMA_SITEMAP_URL = "https://glama.ai/sitemaps/mcp-servers.xml";

interface GlamaServer {
  id: string;
  name: string;
  namespace: string;
  slug: string;
  description: string;
  url: string;
  attributes: string[];
  tools: Array<{ name: string; description?: string }>;
  repository?: {
    url: string;
  };
  environmentVariablesJsonSchema?: Record<string, unknown>;
  spdxLicense?: {
    name: string;
    url: string;
  } | null;
}

interface GlamaResponse {
  pageInfo: {
    endCursor: string;
    startCursor: string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  servers: GlamaServer[];
}

export class GlamaSource extends SyncSource {
  readonly name = "glama" as const;

  /**
   * Fetch additional servers from Glama's sitemap.
   * Their API is limited to ~100 servers, but sitemap has ~500.
   */
  private async fetchFromSitemap(seenUrls: Set<string>): Promise<DiscoveredServer[]> {
    console.log("  glama: fetching additional servers from sitemap...");

    const response = await fetch(GLAMA_SITEMAP_URL);
    if (!response.ok) {
      console.warn(`  glama: sitemap fetch failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    const urlMatches = xml.matchAll(/<loc>https:\/\/glama\.ai\/mcp\/servers\/([^<]+)<\/loc>/g);

    const servers: DiscoveredServer[] = [];

    for (const match of urlMatches) {
      const slug = match[1];

      // Extract GitHub info from @username/repo format
      if (!slug.startsWith("@")) continue;

      const ghPath = slug.slice(1); // Remove @
      const [owner, repo] = ghPath.split("/");
      if (!owner || !repo) continue;

      const githubUrl = `https://github.com/${owner}/${repo}`;
      const glamaUrl = `https://glama.ai/mcp/servers/${slug}`;

      // Skip if already seen from API
      if (seenUrls.has(githubUrl) || seenUrls.has(glamaUrl)) continue;
      seenUrls.add(githubUrl);

      servers.push({
        canonicalUrl: githubUrl,
        githubOwner: owner,
        githubRepo: repo,
        name: repo,
        description: undefined,
        source: "glama",
        sourceIdentifier: slug,
        sourceUrl: glamaUrl,
        sourceData: { fromSitemap: true },
      });
    }

    console.log(`  glama: found ${servers.length} additional servers from sitemap`);
    return servers;
  }

  async *fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch> {
    const seenUrls = new Set<string>();
    let cursor: string | undefined;
    let totalFetched = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    // Phase 1: Fetch from API (limited to ~100)
    while (true) {
      const url = cursor
        ? `${GLAMA_API_URL}?after=${encodeURIComponent(cursor)}`
        : GLAMA_API_URL;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Glama API error: ${response.status}`);
      }

      // Glama API sometimes returns invalid JSON (unescaped backslashes, etc.)
      // Use jsonrepair to fix common issues
      let data: GlamaResponse;
      const text = await response.text();
      try {
        data = JSON.parse(text);
        consecutiveErrors = 0;
      } catch {
        try {
          const repaired = jsonrepair(text);
          data = JSON.parse(repaired);
          consecutiveErrors = 0;
        } catch (e) {
          console.warn(`  glama: skipping page with unfixable JSON (cursor: ${cursor?.slice(0, 20)}...): ${e}`);
          consecutiveErrors++;

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.warn(`  glama: too many consecutive errors, stopping`);
            return;
          }

          // Try to extract cursor from malformed response to continue
          const cursorMatch = text.match(/"endCursor"\s*:\s*"([^"]+)"/);
          if (cursorMatch) {
            cursor = cursorMatch[1];
            await delay(100);
            continue;
          }
          return;
        }
      }
      const servers: DiscoveredServer[] = [];
      let filtered = 0;

      for (const srv of data.servers) {
        const repoUrl = srv.repository?.url;
        const githubUrl = repoUrl ? normalizeGitHubUrl(repoUrl) : null;
        const glamaUrl = srv.url.startsWith("http") ? srv.url : `https://glama.ai${srv.url}`;

        // Use GitHub URL if available, otherwise use Glama URL as canonical
        const canonicalUrl = githubUrl || glamaUrl;

        // Skip duplicates within this source
        if (seenUrls.has(canonicalUrl)) {
          filtered++;
          continue;
        }
        seenUrls.add(canonicalUrl);

        const parsed = repoUrl ? parseGitHubUrl(repoUrl) : null;

        servers.push({
          canonicalUrl,
          githubOwner: parsed?.owner,
          githubRepo: parsed?.repo,
          name: srv.name,
          description: srv.description,
          source: "glama",
          sourceIdentifier: srv.id,
          sourceUrl: glamaUrl,
          sourceData: srv,
        });

        totalFetched++;

        if (options.limit && totalFetched >= options.limit) {
          yield {
            servers,
            hasMore: false,
            stats: { fetched: totalFetched, filtered, errors: 0 },
          };
          return;
        }
      }

      const hasMore = data.pageInfo.hasNextPage;

      yield {
        servers,
        hasMore,
        stats: { fetched: data.servers.length, filtered, errors: 0 },
      };

      if (!hasMore) break;
      cursor = data.pageInfo.endCursor;
      await delay(100);
    }

    // Phase 2: Fetch additional servers from sitemap (bypasses API limit)
    if (!options.limit || totalFetched < options.limit) {
      const sitemapServers = await this.fetchFromSitemap(seenUrls);

      if (sitemapServers.length > 0) {
        const remaining = options.limit ? options.limit - totalFetched : sitemapServers.length;
        const toYield = sitemapServers.slice(0, remaining);

        yield {
          servers: toYield,
          hasMore: false,
          stats: { fetched: toYield.length, filtered: sitemapServers.length - toYield.length, errors: 0 },
        };
      }
    }
  }
}
