import { SyncSource, DiscoveredServer, SyncSourceOptions, SyncBatch, normalizeGitHubUrl, parseGitHubUrl, delay } from "./base";

const NPM_SEARCH_URL = "https://registry.npmjs.org/-/v1/search";

// Quality filters
const MIN_WEEKLY_DOWNLOADS = 10;
const EXCLUDED_NAME_PATTERNS = [/^test-/, /-test$/, /example/, /demo/, /template/, /boilerplate/];

interface NpmPackage {
  package: {
    name: string;
    version: string;
    description?: string;
    keywords?: string[];
    date: string;
    links?: {
      npm?: string;
      homepage?: string;
      repository?: string;
      bugs?: string;
    };
    publisher?: {
      username: string;
      email?: string;
    };
    maintainers?: Array<{ username: string; email?: string }>;
  };
  downloads?: {
    weekly: number;
    monthly: number;
  };
  score?: {
    final: number;
    detail?: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}

export class NpmSource extends SyncSource {
  readonly name = "npm" as const;

  async *fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch> {
    let from = 0;
    const size = 250;
    let totalFetched = 0;
    const seenPackages = new Set<string>();

    while (true) {
      const url = `${NPM_SEARCH_URL}?text=keywords:mcp-server&size=${size}&from=${from}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`npm API error: ${response.status}`);
      }

      const data = await response.json();
      const servers: DiscoveredServer[] = [];
      let filtered = 0;
      let errors = 0;

      for (const pkg of data.objects as NpmPackage[]) {
        try {
          const name = pkg.package.name;

          // Skip duplicates
          if (seenPackages.has(name)) {
            filtered++;
            continue;
          }
          seenPackages.add(name);

          // Quality filter: minimum downloads
          if ((pkg.downloads?.weekly ?? 0) < MIN_WEEKLY_DOWNLOADS) {
            filtered++;
            continue;
          }

          // Quality filter: excluded patterns
          if (EXCLUDED_NAME_PATTERNS.some((p) => p.test(name))) {
            filtered++;
            continue;
          }

          // Get repository URL
          const repoUrl = pkg.package.links?.repository;
          if (!repoUrl) {
            filtered++;
            continue;
          }

          // Must have GitHub repo
          const canonicalUrl = normalizeGitHubUrl(repoUrl);
          if (!canonicalUrl) {
            filtered++;
            continue;
          }

          const parsed = parseGitHubUrl(repoUrl);

          servers.push({
            canonicalUrl,
            githubOwner: parsed?.owner,
            githubRepo: parsed?.repo,
            name: name,
            description: pkg.package.description,
            version: pkg.package.version,
            npmPackage: name,
            npmDownloads: pkg.downloads?.weekly,
            npmQualityScore: pkg.score?.detail?.quality,
            installCommand: `npx -y ${name}`,
            lastUpdatedAt: pkg.package.date ? new Date(pkg.package.date) : undefined,
            source: "npm",
            sourceIdentifier: name,
            sourceUrl: `https://www.npmjs.com/package/${name}`,
            sourceData: pkg,
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
          console.error(`Error processing npm package:`, err);
        }
      }

      const hasMore = data.objects.length === size && data.total > from + size;

      yield {
        servers,
        hasMore,
        stats: { fetched: data.objects.length, filtered, errors },
      };

      if (!hasMore) break;
      from += size;
      await delay(100); // Rate limiting
    }
  }
}
