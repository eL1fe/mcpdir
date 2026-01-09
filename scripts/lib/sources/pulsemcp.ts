import { existsSync, readFileSync } from "fs";
import {
  SyncSource,
  DiscoveredServer,
  SyncSourceOptions,
  SyncBatch,
  normalizeGitHubUrl,
  parseGitHubUrl,
  delay,
} from "./base";

const BASE_URL = "https://www.pulsemcp.com";
const CACHE_FILE = "data/pulsemcp-slugs.json";
const SERVERS_PER_PAGE = 42;
const DELAY_MS = 300;

interface PulseServer {
  slug: string;
  name?: string;
  description?: string;
  provider?: string;
  providerUrl?: string;
  classification?: string;
  githubUrl?: string;
  starsCount?: number;
  serverId?: string;
}

export class PulseMcpSource extends SyncSource {
  readonly name = "pulsemcp" as const;

  private async fetchPage(page: number): Promise<string> {
    const url = page === 1 ? `${BASE_URL}/servers` : `${BASE_URL}/servers?page=${page}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "MCPDir-Sync/1.0 (https://mcpdir.com)",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page ${page}: ${response.status}`);
    }

    return response.text();
  }

  private extractSlugs(html: string): string[] {
    const slugs: string[] = [];
    const pattern = /href="\/servers\/([a-zA-Z0-9_-]+)"/g;
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const slug = match[1];
      if (!slug.includes("?") && slug !== "servers" && !slugs.includes(slug)) {
        slugs.push(slug);
      }
    }

    return slugs;
  }

  private async fetchServerDetails(slug: string): Promise<Partial<PulseServer>> {
    const url = `${BASE_URL}/servers/${slug}`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MCPDir-Sync/1.0 (https://mcpdir.com)",
          Accept: "text/html",
        },
      });

      if (!response.ok) {
        return {};
      }

      const html = await response.text();
      const details: Partial<PulseServer> = {};

      // Extract title/name from h1
      const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (titleMatch) {
        details.name = titleMatch[1].trim();
      }

      // Extract description from meta tag
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
      if (descMatch) {
        details.description = descMatch[1]
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/^MCP \(Model Context Protocol\) Server\.\s*/i, "");
      }

      // Extract GitHub URL (uses data-test-id attribute)
      const githubMatch = html.match(
        /data-test-id="mcp-server-github-repo"\s+href="(https:\/\/github\.com\/[^"]+)"/
      );
      if (githubMatch) {
        details.githubUrl = githubMatch[1];
      }

      // Extract stars count
      const starsMatch = html.match(/GitHub Repo\s*\(([0-9.,]+k?)\s*stars?\)/i);
      if (starsMatch) {
        const stars = starsMatch[1].replace(",", "");
        if (stars.endsWith("k")) {
          details.starsCount = Math.round(parseFloat(stars) * 1000);
        } else {
          details.starsCount = parseInt(stars);
        }
      }

      // Extract classification (official/community/reference)
      const classMatch = html.match(
        /Classification<\/p>\s*<div[^>]*>\s*<img[^>]*>\s*<span[^>]*>(\w+)<\/span>/i
      );
      if (classMatch) {
        details.classification = classMatch[1].toLowerCase();
      }

      // Extract provider
      const providerMatch = html.match(/Provider<\/p>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/i);
      if (providerMatch) {
        details.providerUrl = providerMatch[1];
        details.provider = providerMatch[2].trim();
      }

      return details;
    } catch {
      return {};
    }
  }

  private getTotalPages(html: string): number {
    const paginationMatch = html.match(/page=(\d+)[^>]*>\s*(?:\d+|Last|»)/gi);
    if (paginationMatch) {
      const maxPage = Math.max(
        ...paginationMatch.map((m) => {
          const num = m.match(/page=(\d+)/);
          return num ? parseInt(num[1]) : 1;
        })
      );
      return maxPage;
    }

    const totalMatch = html.match(/(\d+,?\d*)\+?\s*servers/i);
    if (totalMatch) {
      const total = parseInt(totalMatch[1].replace(",", ""));
      return Math.ceil(total / SERVERS_PER_PAGE);
    }

    return 200;
  }

  async *fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch> {
    const seenUrls = new Set<string>();
    let totalFetched = 0;
    let filtered = 0;

    // Check for cached data first
    if (existsSync(CACHE_FILE)) {
      console.log(`  pulsemcp: loading from cache (${CACHE_FILE})...`);
      const cached: PulseServer[] = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));

      // Filter to only servers with GitHub URLs
      const withGithub = cached.filter((s) => s.githubUrl);
      console.log(
        `  pulsemcp: ${cached.length} cached, ${withGithub.length} with GitHub URLs`
      );

      const BATCH_SIZE = 100;
      let batch: DiscoveredServer[] = [];

      for (const srv of withGithub) {
        const githubUrl = normalizeGitHubUrl(srv.githubUrl!);
        if (!githubUrl) {
          filtered++;
          continue;
        }

        if (seenUrls.has(githubUrl)) {
          filtered++;
          continue;
        }
        seenUrls.add(githubUrl);

        const parsed = parseGitHubUrl(githubUrl);

        batch.push({
          canonicalUrl: githubUrl,
          githubOwner: parsed?.owner,
          githubRepo: parsed?.repo,
          name: srv.name || srv.slug,
          description: srv.description,
          stars: srv.starsCount,
          source: "pulsemcp",
          sourceIdentifier: srv.slug,
          sourceUrl: `${BASE_URL}/servers/${srv.slug}`,
          sourceData: srv as unknown as Record<string, unknown>,
        });

        totalFetched++;

        // Yield batch when full
        if (batch.length >= BATCH_SIZE) {
          const hasMore = totalFetched < withGithub.length && (!options.limit || totalFetched < options.limit);
          yield {
            servers: batch,
            hasMore,
            stats: { fetched: batch.length, filtered: 0, errors: 0 },
          };
          batch = [];
        }

        if (options.limit && totalFetched >= options.limit) {
          break;
        }
      }

      // Yield remaining
      if (batch.length > 0) {
        yield {
          servers: batch,
          hasMore: false,
          stats: { fetched: batch.length, filtered, errors: 0 },
        };
      }
      return;
    }

    // Live scraping mode
    console.log("  pulsemcp: no cache found, scraping live...");
    console.log("  pulsemcp: tip: run 'pnpm tsx scripts/scrape-pulsemcp.ts --details' first for faster sync");

    const firstPageHtml = await this.fetchPage(1);
    const totalPages = this.getTotalPages(firstPageHtml);
    console.log(`  pulsemcp: ${totalPages} pages to fetch`);

    // Process first page
    const firstSlugs = this.extractSlugs(firstPageHtml);

    for (const slug of firstSlugs) {
      await delay(DELAY_MS);
      const details = await this.fetchServerDetails(slug);

      if (!details.githubUrl) {
        filtered++;
        continue;
      }

      const githubUrl = normalizeGitHubUrl(details.githubUrl);
      if (!githubUrl || seenUrls.has(githubUrl)) {
        filtered++;
        continue;
      }
      seenUrls.add(githubUrl);

      const parsed = parseGitHubUrl(githubUrl);

      yield {
        servers: [
          {
            canonicalUrl: githubUrl,
            githubOwner: parsed?.owner,
            githubRepo: parsed?.repo,
            name: details.name || slug,
            description: details.description,
            stars: details.starsCount,
            source: "pulsemcp",
            sourceIdentifier: slug,
            sourceUrl: `${BASE_URL}/servers/${slug}`,
            sourceData: details,
          },
        ],
        hasMore: true,
        stats: { fetched: 1, filtered: 0, errors: 0 },
      };

      totalFetched++;
      if (options.limit && totalFetched >= options.limit) {
        return;
      }
    }

    // Process remaining pages
    for (let page = 2; page <= totalPages; page++) {
      await delay(DELAY_MS);

      try {
        const html = await this.fetchPage(page);
        const slugs = this.extractSlugs(html);

        if (slugs.length === 0) {
          console.log(`  pulsemcp: page ${page} empty, stopping`);
          break;
        }

        console.log(`  pulsemcp: page ${page}/${totalPages} (${slugs.length} servers)`);

        for (const slug of slugs) {
          await delay(DELAY_MS);
          const details = await this.fetchServerDetails(slug);

          if (!details.githubUrl) {
            filtered++;
            continue;
          }

          const githubUrl = normalizeGitHubUrl(details.githubUrl);
          if (!githubUrl || seenUrls.has(githubUrl)) {
            filtered++;
            continue;
          }
          seenUrls.add(githubUrl);

          const parsed = parseGitHubUrl(githubUrl);

          yield {
            servers: [
              {
                canonicalUrl: githubUrl,
                githubOwner: parsed?.owner,
                githubRepo: parsed?.repo,
                name: details.name || slug,
                description: details.description,
                stars: details.starsCount,
                source: "pulsemcp",
                sourceIdentifier: slug,
                sourceUrl: `${BASE_URL}/servers/${slug}`,
                sourceData: details,
              },
            ],
            hasMore: page < totalPages,
            stats: { fetched: 1, filtered: 0, errors: 0 },
          };

          totalFetched++;
          if (options.limit && totalFetched >= options.limit) {
            return;
          }
        }
      } catch (error) {
        console.error(`  pulsemcp: error on page ${page}:`, error);
        break;
      }
    }
  }
}
