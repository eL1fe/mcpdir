import { SyncSource, DiscoveredServer, SyncSourceOptions, SyncBatch, normalizeGitHubUrl, parseGitHubUrl, delay } from "./base";

const GLAMA_API_URL = "https://glama.ai/api/mcp/v1/servers";

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

  async *fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch> {
    const seenUrls = new Set<string>();
    let cursor: string | undefined;
    let totalFetched = 0;

    while (true) {
      const url = cursor
        ? `${GLAMA_API_URL}?after=${encodeURIComponent(cursor)}`
        : GLAMA_API_URL;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Glama API error: ${response.status}`);
      }

      const data: GlamaResponse = await response.json();
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
  }
}
