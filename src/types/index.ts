import type { Server, Category, Tag, ServerSource } from "@/lib/db/schema";

export type { Server, Category, Tag, ServerSource };

// Extended types with relations
export interface ServerWithRelations extends Omit<Server, 'githubRepoId' | 'npmDownloads' | 'npmQualityScore' | 'discoveredSources'> {
  categories: string[];
  categoryNames?: string[];
  tags: string[];
  tagNames?: string[];
  // Multi-source fields (optional for backwards compatibility)
  githubRepoId?: number | null;
  npmDownloads?: number | null;
  npmQualityScore?: string | null;
  discoveredSources?: string[] | null;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total?: number;
}

export interface StatsResponse {
  servers: number;
  categories: number;
  totalStars: number;
}

// Tool/Resource/Prompt types (from MCP)
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}
