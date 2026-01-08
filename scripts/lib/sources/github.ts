import { SyncSource, DiscoveredServer, SyncSourceOptions, SyncBatch, delay } from "./base";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";
const TOPICS = ["mcp-server", "model-context-protocol"];

// Quality filters
const MIN_STARS = 1;
const MAX_DAYS_INACTIVE = 365;

// Exclusion list: repos that use MCP but are not MCP servers (lowercase)
const EXCLUDED_REPOS = new Set([
  // Anthropic repos
  "anthropics/claude-code", // MCP client
  "anthropics/anthropic-quickstarts", // Examples, not servers
  "anthropics/courses", // Educational content
  // Google repos
  "google-gemini/gemini-cli", // MCP client, not server
  // Platforms that integrate MCP but are not MCP servers
  "n8n-io/n8n", // Workflow automation
  "assafelovic/gpt-researcher", // Research tool
  "bytedance/ui-tars-desktop", // UI automation
  "activepieces/activepieces", // Automation platform
  "1panel-dev/maxkb", // Knowledge base
  "sansan0/trendradar", // Trend analysis tool
  "netdata/netdata", // Infrastructure monitoring platform
]);

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  visibility: string;
  archived: boolean;
  default_branch: string;
}

function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN;
}

export class GitHubSource extends SyncSource {
  readonly name = "github" as const;

  async *fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch> {
    const seenRepos = new Set<number>();
    let totalFetched = 0;

    for (const topic of TOPICS) {
      let page = 1;

      while (true) {
        const url = `${GITHUB_SEARCH_URL}?q=topic:${topic}&sort=stars&order=desc&per_page=100&page=${page}`;

        const headers: Record<string, string> = {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "mcp-hub-sync",
        };

        const token = getGitHubToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          if (response.status === 403) {
            const remaining = response.headers.get("x-ratelimit-remaining");
            if (remaining === "0") {
              console.warn("GitHub rate limit exceeded, stopping GitHub source");
              return;
            }
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        const servers: DiscoveredServer[] = [];
        let filtered = 0;
        let errors = 0;

        for (const repo of data.items as GitHubRepo[]) {
          try {
            // Skip duplicates (same repo found via different topics)
            if (seenRepos.has(repo.id)) {
              filtered++;
              continue;
            }
            seenRepos.add(repo.id);

            // Quality filter: minimum stars
            if (repo.stargazers_count < MIN_STARS) {
              filtered++;
              continue;
            }

            // Quality filter: not too stale
            const daysSinceUpdate = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate > MAX_DAYS_INACTIVE) {
              filtered++;
              continue;
            }

            // Skip forks
            if (repo.fork) {
              filtered++;
              continue;
            }

            // Skip archived repos
            if (repo.archived) {
              filtered++;
              continue;
            }

            // Skip excluded repos (MCP clients, examples, etc.)
            if (EXCLUDED_REPOS.has(repo.full_name.toLowerCase())) {
              filtered++;
              continue;
            }

            const canonicalUrl = `https://github.com/${repo.owner.login.toLowerCase()}/${repo.name.toLowerCase()}`;

            servers.push({
              canonicalUrl,
              githubOwner: repo.owner.login,
              githubRepo: repo.name,
              githubRepoId: repo.id,
              name: repo.name,
              description: repo.description || undefined,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              lastUpdatedAt: new Date(repo.pushed_at),
              source: "github",
              sourceIdentifier: String(repo.id),
              sourceUrl: repo.html_url,
              sourceData: repo,
            });

            totalFetched++;

            // Respect limit for testing
            if (options.limit && totalFetched >= options.limit) {
              yield {
                servers,
                hasMore: false,
                stats: { fetched: totalFetched, filtered, errors },
              };
              return;
            }
          } catch (err) {
            errors++;
            console.error(`Error processing GitHub repo:`, err);
          }
        }

        // GitHub limits search to 1000 results (10 pages of 100)
        const hasMore = data.items.length === 100 && page < 10;

        yield {
          servers,
          hasMore,
          stats: { fetched: data.items.length, filtered, errors },
        };

        if (!hasMore) break;
        page++;

        // GitHub rate limiting: 30 requests per minute for search
        await delay(2000);
      }
    }
  }
}
