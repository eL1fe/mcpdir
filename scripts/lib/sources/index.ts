export * from "./base";
export { McpRegistrySource } from "./mcp-registry";
export { NpmSource } from "./npm";
export { GitHubSource } from "./github";
export { GlamaSource } from "./glama";
export { PulseMcpSource } from "./pulsemcp";

import { SyncSource, SourceType } from "./base";
import { McpRegistrySource } from "./mcp-registry";
import { NpmSource } from "./npm";
import { GitHubSource } from "./github";
import { GlamaSource } from "./glama";
import { PulseMcpSource } from "./pulsemcp";

const sources: Record<SourceType, () => SyncSource> = {
  "mcp-registry": () => new McpRegistrySource(),
  npm: () => new NpmSource(),
  github: () => new GitHubSource(),
  glama: () => new GlamaSource(),
  pulsemcp: () => new PulseMcpSource(),
  pypi: () => {
    throw new Error("PyPI source not implemented yet");
  },
};

export function getSource(name: SourceType): SyncSource {
  const factory = sources[name];
  if (!factory) {
    throw new Error(`Unknown source: ${name}`);
  }
  return factory();
}

export function getAllSources(): SyncSource[] {
  return [new McpRegistrySource(), new NpmSource(), new GitHubSource(), new GlamaSource(), new PulseMcpSource()];
}
