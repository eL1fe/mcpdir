import { SyncSource, DiscoveredServer, SyncSourceOptions, SyncBatch, normalizeGitHubUrl, parseGitHubUrl, delay } from "./base";

const MCP_REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0.1/servers";

interface RegistryServer {
  server: {
    name: string;
    title?: string;
    description?: string;
    version?: string;
    repository?: {
      url: string;
      source: string;
    };
    packages?: Array<{
      registryType: string;
      identifier: string;
    }>;
  };
  _meta?: {
    "io.modelcontextprotocol.registry/official"?: {
      status?: string;
      isLatest?: boolean;
    };
  };
}

function getInstallCommand(packages?: RegistryServer["server"]["packages"]): string {
  if (!packages?.length) return "";

  const npm = packages.find((p) => p.registryType === "npm");
  if (npm) return `npx -y ${npm.identifier}`;

  const pip = packages.find((p) => p.registryType === "pip" || p.registryType === "pypi");
  if (pip) return `uvx ${pip.identifier}`;

  return "";
}

export class McpRegistrySource extends SyncSource {
  readonly name = "mcp-registry" as const;

  async *fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch> {
    const seenNames = new Set<string>();
    let cursor: string | undefined;
    let totalFetched = 0;

    while (true) {
      const url = cursor
        ? `${MCP_REGISTRY_URL}?cursor=${encodeURIComponent(cursor)}`
        : MCP_REGISTRY_URL;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Registry API error: ${response.status}`);
      }

      const data = await response.json();
      const servers: DiscoveredServer[] = [];
      let filtered = 0;

      for (const srv of data.servers as RegistryServer[]) {
        const name = srv.server?.name;
        const isLatest = srv._meta?.["io.modelcontextprotocol.registry/official"]?.isLatest;

        // Skip non-latest versions and duplicates
        if (!name || !isLatest) {
          filtered++;
          continue;
        }

        if (seenNames.has(name)) {
          filtered++;
          continue;
        }

        seenNames.add(name);

        // Get GitHub URL
        const repoUrl = srv.server.repository?.url;
        const canonicalUrl = repoUrl ? normalizeGitHubUrl(repoUrl) : null;

        // Skip servers without GitHub repo (can't deduplicate)
        if (!canonicalUrl) {
          filtered++;
          continue;
        }

        const parsed = parseGitHubUrl(repoUrl!);
        const npm = srv.server.packages?.find((p) => p.registryType === "npm");
        const pip = srv.server.packages?.find((p) => p.registryType === "pip" || p.registryType === "pypi");

        servers.push({
          canonicalUrl,
          githubOwner: parsed?.owner,
          githubRepo: parsed?.repo,
          name: srv.server.title || name.split("/").pop() || name,
          description: srv.server.description,
          version: srv.server.version,
          npmPackage: npm?.identifier,
          pypiPackage: pip?.identifier,
          installCommand: getInstallCommand(srv.server.packages),
          source: "mcp-registry",
          sourceIdentifier: name,
          sourceUrl: `https://registry.modelcontextprotocol.io/servers/${encodeURIComponent(name)}`,
          sourceData: srv,
        });

        totalFetched++;

        // Respect limit for testing
        if (options.limit && totalFetched >= options.limit) {
          yield {
            servers,
            hasMore: false,
            stats: { fetched: totalFetched, filtered, errors: 0 },
          };
          return;
        }
      }

      const hasMore = !!data.metadata?.nextCursor;

      yield {
        servers,
        hasMore,
        stats: { fetched: data.servers.length, filtered, errors: 0 },
      };

      if (!hasMore) break;
      cursor = data.metadata.nextCursor;
      await delay(100); // Rate limiting
    }
  }
}
