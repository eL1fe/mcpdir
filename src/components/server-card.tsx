import Link from "next/link";
import { Star, Wrench, CheckCircle, ShieldCheck, ArrowUpRight, Settings, XCircle } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { SourceBadges } from "./source-badges";
import type { ServerWithRelations } from "@/types";

interface ServerCardProps {
  server: ServerWithRelations;
  featured?: boolean;
}

export function ServerCard({ server, featured = false }: ServerCardProps) {
  const tools = (server.tools as { name: string }[]) ?? [];
  const isOfficial = server.tags?.includes("official");
  const isValidated = server.validationStatus === "validated";
  const needsConfig = server.validationStatus === "needs_config";
  const isFailed = server.validationStatus === "failed";

  return (
    <Link href={`/servers/${server.slug}`} className="block group">
      <GlassCard
        glow={featured ? "cyan" : "none"}
        className={`h-full flex flex-col ${featured ? "min-h-[280px]" : ""}`}
      >
        <GlassCardHeader className="flex-none pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <GlassCardTitle className={`group-hover:text-cyan transition-colors truncate ${featured ? "text-xl" : "text-base"}`}>
                {server.name}
              </GlassCardTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {isOfficial && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-[var(--status-official-bg)] text-[var(--status-official)] border-[var(--status-official)]/30">
                    <CheckCircle className="h-3 w-3" />
                    Official
                  </Badge>
                )}
                {isValidated && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-[var(--status-validated-bg)] text-[var(--status-validated)] border-[var(--status-validated)]/30">
                    <ShieldCheck className="h-3 w-3" />
                    Validated
                  </Badge>
                )}
                {needsConfig && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30">
                    <Settings className="h-3 w-3" />
                    Needs Setup
                  </Badge>
                )}
                {isFailed && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1 bg-[var(--status-failed-bg)] text-[var(--status-failed)] border-[var(--status-failed)]/30">
                    <XCircle className="h-3 w-3" />
                    Failed
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {(server.starsCount ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span className="text-sm tabular-nums">{server.starsCount?.toLocaleString()}</span>
                </div>
              )}
              <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </GlassCardHeader>

        <GlassCardContent className="flex-1 flex flex-col pt-3">
          <p className={`text-muted-foreground ${featured ? "line-clamp-3" : "line-clamp-2"} text-sm leading-relaxed`}>
            {server.description}
          </p>

          {server.installCommand && featured && (
            <div className="mt-4">
              <code className="block px-3 py-2 bg-black/40 rounded-lg text-xs font-mono truncate text-cyan/90 border border-[var(--glass-border)]">
                {server.installCommand}
              </code>
            </div>
          )}

          <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-[var(--glass-border)]">
            <div className="flex items-center gap-3 flex-wrap">
              {tools.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  <span>{tools.length} {tools.length === 1 ? "tool" : "tools"}</span>
                </div>
              )}
            </div>
            <SourceBadges sources={server.discoveredSources} compact />
          </div>
        </GlassCardContent>
      </GlassCard>
    </Link>
  );
}
