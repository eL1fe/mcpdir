"use client";

import { Star, GitFork, Scale, Calendar, ExternalLink } from "lucide-react";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { GitHubRepoMetadata } from "@/lib/github";

interface GitHubPreviewProps {
  metadata: GitHubRepoMetadata;
}

export function GitHubPreview({ metadata }: GitHubPreviewProps) {
  return (
    <GlassCard>
      <GlassCardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg truncate">{metadata.fullName}</h3>
              <a
                href={metadata.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-cyan transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {metadata.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {metadata.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 text-amber-400" />
            <span className="tabular-nums">{metadata.starsCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitFork className="h-4 w-4" />
            <span className="tabular-nums">{metadata.forksCount.toLocaleString()}</span>
          </div>
          {metadata.language && (
            <Badge variant="secondary" className="text-xs">
              {metadata.language}
            </Badge>
          )}
          {metadata.license && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Scale className="h-3.5 w-3.5" />
              <span>{metadata.license}</span>
            </div>
          )}
        </div>

        {metadata.topics.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {metadata.topics.slice(0, 5).map((topic) => (
              <Badge key={topic} variant="outline" className="text-xs">
                {topic}
              </Badge>
            ))}
            {metadata.topics.length > 5 && (
              <span className="text-xs text-muted-foreground">
                +{metadata.topics.length - 5} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            Updated {new Date(metadata.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
