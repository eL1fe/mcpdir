import { Badge } from "@/components/ui/badge";
import { Download, Github, Box, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceBadgesProps {
  sources?: string[] | null;
  npmDownloads?: number | null;
  compact?: boolean;
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  "mcp-registry": Box,
  npm: FileCode,
  github: Github,
  pypi: FileCode,
};

const SOURCE_LABELS: Record<string, string> = {
  "mcp-registry": "Registry",
  npm: "npm",
  github: "GitHub",
  pypi: "PyPI",
};

const SOURCE_COLORS: Record<string, string> = {
  "mcp-registry": "bg-purple/20 text-purple border-purple/30",
  npm: "bg-red-500/20 text-red-400 border-red-500/30",
  github: "bg-white/10 text-muted-foreground border-white/20",
  pypi: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

export function SourceBadges({ sources, npmDownloads, compact = false }: SourceBadgesProps) {
  if (!sources?.length && !npmDownloads) return null;

  // Deduplicate sources
  const uniqueSources = sources ? [...new Set(sources)] : [];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {uniqueSources.map((source) => {
          const Icon = SOURCE_ICONS[source] ?? Box;
          return (
            <div
              key={source}
              className="text-muted-foreground"
              title={SOURCE_LABELS[source] || source}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {uniqueSources.map((source) => (
        <Badge
          key={source}
          variant="outline"
          className={cn("text-xs", SOURCE_COLORS[source] || "")}
        >
          {SOURCE_LABELS[source] || source}
        </Badge>
      ))}
      {npmDownloads && npmDownloads > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Download className="h-3 w-3" />
          {formatDownloads(npmDownloads)}/wk
        </span>
      )}
    </div>
  );
}
