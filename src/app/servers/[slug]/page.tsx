import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  GitFork,
  ExternalLink,
  CheckCircle,
  Wrench,
  FileText,
  MessageSquare,
  Settings,
  ShieldCheck,
  XCircle,
  Copy,
  Github,
  Clock,
} from "lucide-react";
import { getServerBySlug } from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { GradientText } from "@/components/ui/gradient-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstallCommand } from "@/components/install-command";
import { ToolsList } from "@/components/tools-list";
import { MarkdownContent } from "@/components/markdown-content";
import { SourceBadges } from "@/components/source-badges";
import { HelpValidateForm } from "@/components/help-validate-form";
import { SITE_URL, generateServerSchema, generateBreadcrumbSchema } from "@/lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const server = await getServerBySlug(slug);

  if (!server) {
    return {
      title: "Server Not Found",
      robots: { index: false },
    };
  }

  const description = server.description
    ? `${server.description.slice(0, 155)}${server.description.length > 155 ? "..." : ""}`
    : `${server.name} is an MCP server for AI integrations. ${(server.tools as { name: string }[])?.length || 0} tools available.`;

  const tools = (server.tools as { name: string }[]) || [];
  const keywords = [
    server.name,
    "MCP server",
    "Model Context Protocol",
    ...tools.slice(0, 5).map((t) => t.name),
    ...(server.categoryNames || []),
  ];

  return {
    title: `${server.name} — MCP Server`,
    description,
    keywords,
    alternates: {
      canonical: `${SITE_URL}/servers/${slug}`,
    },
    openGraph: {
      type: "article",
      title: `${server.name} — MCP Server`,
      description,
      url: `${SITE_URL}/servers/${slug}`,
      images: [
        {
          url: `${SITE_URL}/og/servers/${slug}`,
          width: 1200,
          height: 630,
          alt: `${server.name} — MCP Server`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${server.name} — MCP Server`,
      description,
      images: [`${SITE_URL}/og/servers/${slug}`],
    },
  };
}

export default async function ServerDetailPage({ params }: Props) {
  const { slug } = await params;
  const server = await getServerBySlug(slug);

  if (!server) {
    notFound();
  }

  const tools = (server.tools as { name: string; description?: string }[]) ?? [];
  const resources = (server.resources as { uri: string; name?: string; description?: string }[]) ?? [];
  const prompts = (server.prompts as { name: string; description?: string }[]) ?? [];
  const isOfficial = server.tags?.includes("official");

  // Parse validation result
  const validationResult = server.validationResult as {
    durationMs?: number;
    serverInfo?: { name?: string; version?: string };
  } | null;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const serverSchema = generateServerSchema({
    name: server.name,
    slug: server.slug,
    description: server.description,
    sourceUrl: server.sourceUrl,
    homepageUrl: server.homepageUrl,
    starsCount: server.starsCount,
    latestVersion: server.latestVersion,
    tools: tools,
    updatedAt: server.updatedAt,
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", url: SITE_URL },
    { name: "Servers", url: `${SITE_URL}/servers` },
    { name: server.name, url: `${SITE_URL}/servers/${server.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([serverSchema, breadcrumbSchema]),
        }}
      />
      <div className="min-h-screen">
        {/* Header with gradient */}
        <div className="relative overflow-hidden border-b border-[var(--glass-border)]">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan/5 via-purple/3 to-transparent" />
          <div className="container mx-auto px-4 py-8 relative z-10">
            {/* Breadcrumb */}
            <Link
              href="/servers"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-cyan transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to servers
            </Link>

          {/* Server header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1 min-w-0">
              {/* Title and badges */}
              <div className="flex items-start gap-4 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold">
                  <GradientText variant="cyan-purple">{server.name}</GradientText>
                </h1>

                {server.sourceUrl && (
                  <Link
                    href={server.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-muted-foreground hover:text-cyan transition-colors"
                  >
                    <Github className="h-6 w-6" />
                  </Link>
                )}
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {isOfficial && (
                  <Badge className="bg-[var(--status-official-bg)] text-[var(--status-official)] border-[var(--status-official)]/30 gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Official
                  </Badge>
                )}
                {server.validationStatus === "validated" && (
                  <Badge className="bg-[var(--status-validated-bg)] text-[var(--status-validated)] border-[var(--status-validated)]/30 gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Validated
                  </Badge>
                )}
                {server.validationStatus === "needs_config" && (
                  <Badge variant="outline" className="gap-1 bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30">
                    <Settings className="h-3 w-3" />
                    Requires Setup
                  </Badge>
                )}
                {server.validationStatus === "failed" && (
                  <Badge className="gap-1 bg-[var(--status-failed-bg)] text-[var(--status-failed)] border-[var(--status-failed)]/30">
                    <XCircle className="h-3 w-3" />
                    Validation Failed
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-lg text-muted-foreground mt-4 max-w-3xl">
                {server.description}
              </p>

              {/* Source badges and categories */}
              <div className="flex flex-wrap items-center gap-4 mt-6">
                {server.discoveredSources?.length && (
                  <SourceBadges sources={server.discoveredSources} npmDownloads={server.npmDownloads} />
                )}

                {server.categoryNames?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {server.categoryNames.map((cat, i) => (
                      <Link key={cat} href={`/categories/${server.categories?.[i]}`}>
                        <Badge variant="outline" className="hover:bg-white/5 transition-colors">
                          {cat}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats sidebar */}
            <div className="lg:w-64 shrink-0">
              <GlassCard className="lg:sticky lg:top-24">
                <GlassCardContent className="p-4 space-y-4">
                  {(server.starsCount ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Stars</span>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Star className="h-4 w-4 text-yellow-500" />
                        {server.starsCount?.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {(server.forksCount ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Forks</span>
                      <div className="flex items-center gap-1.5 font-medium">
                        <GitFork className="h-4 w-4 text-muted-foreground" />
                        {server.forksCount?.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {tools.length > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tools</span>
                      <div className="flex items-center gap-1.5 font-medium">
                        <Wrench className="h-4 w-4 text-cyan" />
                        {tools.length}
                      </div>
                    </div>
                  )}
                  {server.lastCommitAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Updated</span>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(server.lastCommitAt)}
                      </div>
                    </div>
                  )}
                  {server.validatedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Validated</span>
                      <div className="flex items-center gap-1.5 text-sm">
                        <ShieldCheck className="h-3.5 w-3.5 text-green" />
                        {formatDate(server.validatedAt)}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="pt-2 space-y-2">
                    {server.sourceUrl && (
                      <Button asChild className="w-full bg-gradient-to-r from-cyan/20 to-purple/20 border border-[var(--glass-border)] hover:from-cyan/30 hover:to-purple/30">
                        <Link href={server.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="h-4 w-4 mr-2" />
                          View Source
                        </Link>
                      </Button>
                    )}
                    {server.homepageUrl && (
                      <Button asChild variant="outline" className="w-full glass border-[var(--glass-border)]">
                        <Link href={server.homepageUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Homepage
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* Validation details (collapsible) */}
                  {server.validationStatus === "validated" && validationResult && (
                    <details className="pt-3 border-t border-[var(--glass-border)]">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        Validation Details
                      </summary>
                      <div className="mt-2 text-xs space-y-1">
                        {validationResult.durationMs && (
                          <p className="text-muted-foreground">
                            Duration: {(validationResult.durationMs / 1000).toFixed(1)}s
                          </p>
                        )}
                        {validationResult.serverInfo && (
                          <p className="text-muted-foreground">
                            Server: {validationResult.serverInfo.name}
                            {validationResult.serverInfo.version && ` v${validationResult.serverInfo.version}`}
                          </p>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Failed validation error */}
                  {server.validationStatus === "failed" && server.validationError && (
                    <div className="pt-3 border-t border-[var(--glass-border)]">
                      <p className="text-xs text-muted-foreground mb-1">Validation Error:</p>
                      <p className="text-xs text-red-400 break-words">{server.validationError}</p>
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>

            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Install Command */}
        {server.installCommand && (
          <GlassCard glow="cyan" className="mb-8">
            <GlassCardHeader>
              <GlassCardTitle>Quick Install</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <InstallCommand command={server.installCommand} />
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Help Validate Form (for needs_config servers) */}
        {server.validationStatus === "needs_config" && (
          <div className="mb-8 max-w-md">
            <HelpValidateForm
              serverId={server.id}
              serverName={server.name}
              packageName={server.packageName}
              existingInstallCommand={server.installCommand}
              envConfigSchema={server.envConfigSchema as Record<string, unknown> | null}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue={server.readmeContent ? "readme" : "tools"} className="w-full">
          <div className="glass rounded-xl p-1 inline-flex mb-6">
            <TabsList className="bg-transparent gap-1">
              {server.readmeContent && (
                <TabsTrigger
                  value="readme"
                  className="data-[state=active]:bg-cyan/20 data-[state=active]:text-cyan rounded-lg"
                >
                  README
                </TabsTrigger>
              )}
              <TabsTrigger
                value="tools"
                className="data-[state=active]:bg-cyan/20 data-[state=active]:text-cyan rounded-lg"
              >
                Tools ({tools.length})
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className="data-[state=active]:bg-cyan/20 data-[state=active]:text-cyan rounded-lg"
              >
                Resources ({resources.length})
              </TabsTrigger>
              <TabsTrigger
                value="prompts"
                className="data-[state=active]:bg-cyan/20 data-[state=active]:text-cyan rounded-lg"
              >
                Prompts ({prompts.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {server.readmeContent && (
            <TabsContent value="readme">
              <GlassCard>
                <GlassCardContent className="prose-container">
                  <MarkdownContent content={server.readmeContent} />
                </GlassCardContent>
              </GlassCard>
            </TabsContent>
          )}

          <TabsContent value="tools">
            {tools.length > 0 ? (
              <GlassCard>
                <GlassCardContent>
                  <ToolsList tools={tools} maxShow={50} />
                </GlassCardContent>
              </GlassCard>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No tools available for this server</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="resources">
            {resources.length > 0 ? (
              <GlassCard>
                <GlassCardContent className="space-y-4">
                  {resources.map((resource) => (
                    <div
                      key={resource.uri}
                      className="flex items-start gap-3 p-3 rounded-lg bg-background/30 border border-[var(--glass-border)]"
                    >
                      <FileText className="h-5 w-5 text-cyan shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <code className="font-mono text-sm text-cyan break-all">
                          {resource.uri}
                        </code>
                        {resource.name && (
                          <p className="text-sm font-medium mt-1">{resource.name}</p>
                        )}
                        {resource.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {resource.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </GlassCardContent>
              </GlassCard>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No resources available for this server</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="prompts">
            {prompts.length > 0 ? (
              <GlassCard>
                <GlassCardContent className="space-y-4">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.name}
                      className="flex items-start gap-3 p-3 rounded-lg bg-background/30 border border-[var(--glass-border)]"
                    >
                      <MessageSquare className="h-5 w-5 text-purple shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <code className="font-mono text-sm text-purple">
                          {prompt.name}
                        </code>
                        {prompt.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {prompt.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </GlassCardContent>
              </GlassCard>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No prompts available for this server</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </>
  );
}
