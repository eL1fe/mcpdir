import { createHash } from "crypto";

// Common interface for discovered servers from any source
export interface DiscoveredServer {
  // Identification
  canonicalUrl: string; // Normalized GitHub URL (primary key for dedup)
  githubOwner?: string;
  githubRepo?: string;
  githubRepoId?: number;

  // Basic info
  name: string;
  description?: string;
  version?: string;

  // Package info
  npmPackage?: string;
  pypiPackage?: string;
  installCommand?: string;

  // Metrics
  stars?: number;
  forks?: number;
  npmDownloads?: number;
  npmQualityScore?: number;
  lastUpdatedAt?: Date;

  // Source metadata
  source: SourceType;
  sourceIdentifier: string; // ID in source system (package name, repo id, etc)
  sourceUrl: string; // Link to source listing
  sourceData: Record<string, unknown>; // Raw API response
}

export type SourceType = "mcp-registry" | "npm" | "github" | "pypi";

export interface SyncSourceOptions {
  forceRefresh?: boolean;
  limit?: number; // For testing
}

export interface SyncBatch {
  servers: DiscoveredServer[];
  hasMore: boolean;
  stats: {
    fetched: number;
    filtered: number; // Removed due to quality filters
    errors: number;
  };
}

// Base class for all sync sources
export abstract class SyncSource {
  abstract readonly name: SourceType;

  // Fetch all servers from this source (generator for pagination)
  abstract fetchServers(options: SyncSourceOptions): AsyncGenerator<SyncBatch>;

  // Compute hash for this source's data (for incremental sync)
  computeContentHash(server: DiscoveredServer): string {
    const data = JSON.stringify({
      source: server.source,
      identifier: server.sourceIdentifier,
      version: server.version,
      name: server.name,
      description: server.description,
    });
    return createHash("sha256").update(data).digest("hex").slice(0, 32);
  }
}

// Normalize GitHub URL to canonical form
export function normalizeGitHubUrl(url: string): string | null {
  if (!url) return null;

  // Handle variations:
  // - https://github.com/owner/repo
  // - https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  // - https://github.com/owner/repo/tree/main/packages/subpackage
  // - git+https://github.com/owner/repo.git

  // Remove git+ prefix
  url = url.replace(/^git\+/, "");

  // Convert SSH to HTTPS
  url = url.replace(/^git@github\.com:/, "https://github.com/");

  // Extract owner/repo
  const match = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.\#]+)/);
  if (!match) return null;

  const owner = match[1].toLowerCase();
  const repo = match[2].toLowerCase().replace(/\.git$/, "");

  return `https://github.com/${owner}/${repo}`;
}

// Parse GitHub URL into owner/repo
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const normalized = normalizeGitHubUrl(url);
  if (!normalized) return null;

  const match = normalized.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  return { owner: match[1], repo: match[2] };
}

// Delay helper for rate limiting
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
