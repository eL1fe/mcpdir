import { DiscoveredServer, SourceType } from "./sources/base";

// Priority for data when merging from multiple sources (lower = higher priority)
const SOURCE_PRIORITY: Record<SourceType, number> = {
  "mcp-registry": 1,
  npm: 2,
  github: 3,
  pypi: 4,
};

// Field-specific priority overrides
const FIELD_PRIORITY: Record<string, SourceType[]> = {
  // Stars always from GitHub
  stars: ["github"],
  forks: ["github"],
  githubRepoId: ["github"],
  // Downloads from npm
  npmDownloads: ["npm"],
  npmQualityScore: ["npm"],
  // Version prefers npm (more up to date than registry)
  version: ["npm", "mcp-registry", "pypi"],
  // Install command from registry or npm
  installCommand: ["mcp-registry", "npm", "pypi"],
};

export interface MergedServer {
  canonicalUrl: string;
  githubOwner?: string;
  githubRepo?: string;
  githubRepoId?: number;
  name: string;
  description?: string;
  version?: string;
  npmPackage?: string;
  pypiPackage?: string;
  installCommand?: string;
  stars?: number;
  forks?: number;
  npmDownloads?: number;
  npmQualityScore?: number;
  lastUpdatedAt?: Date;
  sources: SourceType[];
  sourceData: Record<SourceType, Record<string, unknown>>;
}

// Deduplicate and merge servers from multiple sources
export function deduplicateServers(
  discovered: Map<string, DiscoveredServer[]>
): MergedServer[] {
  const merged: MergedServer[] = [];

  for (const [canonicalUrl, servers] of discovered) {
    if (servers.length === 0) continue;

    // Sort by source priority
    const sorted = [...servers].sort(
      (a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source]
    );

    // Start with highest priority source
    const primary = sorted[0];
    const result: MergedServer = {
      canonicalUrl,
      githubOwner: primary.githubOwner,
      githubRepo: primary.githubRepo,
      githubRepoId: primary.githubRepoId,
      name: primary.name,
      description: primary.description,
      version: primary.version,
      npmPackage: primary.npmPackage,
      pypiPackage: primary.pypiPackage,
      installCommand: primary.installCommand,
      stars: primary.stars,
      forks: primary.forks,
      npmDownloads: primary.npmDownloads,
      npmQualityScore: primary.npmQualityScore,
      lastUpdatedAt: primary.lastUpdatedAt,
      sources: servers.map((s) => s.source),
      sourceData: {},
    };

    // Collect all source data
    for (const server of servers) {
      result.sourceData[server.source] = server.sourceData;
    }

    // Apply field-specific priority overrides
    for (const [field, prioritySources] of Object.entries(FIELD_PRIORITY)) {
      for (const source of prioritySources) {
        const server = servers.find((s) => s.source === source);
        if (server && (server as Record<string, unknown>)[field] !== undefined) {
          (result as Record<string, unknown>)[field] = (server as Record<string, unknown>)[field];
          break;
        }
      }
    }

    // Merge missing fields from other sources
    for (const server of sorted.slice(1)) {
      if (!result.githubRepoId && server.githubRepoId) {
        result.githubRepoId = server.githubRepoId;
      }
      if (!result.description && server.description) {
        result.description = server.description;
      }
      if (!result.version && server.version) {
        result.version = server.version;
      }
      if (!result.npmPackage && server.npmPackage) {
        result.npmPackage = server.npmPackage;
      }
      if (!result.pypiPackage && server.pypiPackage) {
        result.pypiPackage = server.pypiPackage;
      }
      if (!result.installCommand && server.installCommand) {
        result.installCommand = server.installCommand;
      }
      if (!result.stars && server.stars) {
        result.stars = server.stars;
      }
      if (!result.forks && server.forks) {
        result.forks = server.forks;
      }
      if (!result.npmDownloads && server.npmDownloads) {
        result.npmDownloads = server.npmDownloads;
      }
      if (!result.npmQualityScore && server.npmQualityScore) {
        result.npmQualityScore = server.npmQualityScore;
      }
      if (!result.lastUpdatedAt && server.lastUpdatedAt) {
        result.lastUpdatedAt = server.lastUpdatedAt;
      }
    }

    merged.push(result);
  }

  return merged;
}

// Group discovered servers by canonical URL (normalized to lowercase)
export function groupByCanonicalUrl(
  servers: DiscoveredServer[]
): Map<string, DiscoveredServer[]> {
  const grouped = new Map<string, DiscoveredServer[]>();

  for (const server of servers) {
    // Normalize to lowercase for consistent grouping
    const key = server.canonicalUrl.toLowerCase();
    const existing = grouped.get(key) || [];
    existing.push(server);
    grouped.set(key, existing);
  }

  return grouped;
}
