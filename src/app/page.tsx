import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Database,
  Globe,
  Wrench,
  Brain,
  CheckSquare,
  Star,
  GitFork,
  Sparkles,
  Zap,
  Shield,
  ShieldCheck,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { GradientHeading, GradientText } from "@/components/ui/gradient-text";
import { SearchCommand } from "@/components/search-command";
import { HeroBackground, GridPattern, FloatingIcons } from "@/components/hero-background";
import { AnimatedCounter } from "@/components/animated-counter";
import { getServers, getCategories, getStats } from "@/lib/db/queries";
import { SITE_CONFIG, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: `${SITE_CONFIG.name} — Discover MCP Servers for AI Development`,
  description:
    "Explore 8000+ Model Context Protocol (MCP) servers. Find AI integrations for databases, APIs, file systems, and developer tools. The npm for AI.",
  keywords: [
    "MCP servers",
    "Model Context Protocol",
    "AI tools directory",
    "Claude integrations",
    "LLM tools",
    "AI development",
    "MCP registry",
  ],
  alternates: {
    canonical: SITE_URL,
  },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  databases: Database,
  "file-systems": Package,
  "apis-services": Globe,
  "dev-tools": Wrench,
  "ai-ml": Brain,
  productivity: CheckSquare,
};

const CATEGORY_COLORS: Record<string, string> = {
  databases: "from-cyan/20 to-blue-500/20",
  "file-systems": "from-green/20 to-emerald-500/20",
  "apis-services": "from-purple/20 to-pink-500/20",
  "dev-tools": "from-orange-400/20 to-amber-500/20",
  "ai-ml": "from-cyan/20 to-purple/20",
  productivity: "from-green/20 to-cyan/20",
};

export default async function HomePage() {
  const [servers, categories, stats] = await Promise.all([
    getServers({ sort: "stars", order: "desc", limit: 6 }),
    getCategories(),
    getStats(),
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero Section - z-20 to ensure dropdown appears above other sections */}
      <section className="relative z-20 min-h-[90vh] flex items-center">
        <HeroBackground />
        <GridPattern />
        <FloatingIcons />

        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-in">
              <Sparkles className="h-4 w-4 text-cyan" />
              <span className="text-sm">The definitive MCP directory</span>
            </div>

            {/* Headline */}
            <GradientHeading
              level={1}
              variant="cyan-purple"
              animate
              className="mb-6 animate-fade-in [animation-delay:100ms]"
            >
              Discover MCP Servers
            </GradientHeading>

            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in [animation-delay:200ms]">
              Explore the ecosystem of Model Context Protocol servers.
              <span className="block mt-2 text-lg">
                The npm for AI integrations.
              </span>
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto mb-10 animate-fade-in [animation-delay:300ms] relative z-50">
              <div className="glass rounded-2xl p-1.5">
                <SearchCommand
                  placeholder="Search 8000+ MCP servers..."
                  className="[&_input]:bg-background/50 [&_input]:border-0 [&_input]:h-14 [&_input]:text-lg [&_input]:rounded-xl"
                />
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap justify-center gap-4 animate-fade-in [animation-delay:400ms]">
              <Button asChild size="lg" className="h-12 px-8 text-base rounded-xl bg-gradient-to-r from-cyan to-purple hover:opacity-90 transition-opacity">
                <Link href="/servers">
                  Browse All Servers
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base rounded-xl glass border-[var(--glass-border)] hover:bg-white/5">
                <Link href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
                  Learn MCP
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Gradient fade at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-[var(--glass-border)]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center group">
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                <AnimatedCounter value={stats.servers} />
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                Servers
              </div>
            </div>
            <div className="text-center group">
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2 flex items-center justify-center gap-2">
                <AnimatedCounter value={stats.validated} />
                <ShieldCheck className="h-6 w-6 text-green-400" />
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                Validated
              </div>
            </div>
            <div className="text-center group">
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                <AnimatedCounter value={stats.categories} />
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                Categories
              </div>
            </div>
            <div className="text-center group">
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                <AnimatedCounter value={stats.totalStars} />
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-wider">
                GitHub Stars
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Servers - Bento Grid */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Trending Servers</h2>
              <p className="text-muted-foreground">Most popular MCP servers this week</p>
            </div>
            <Button asChild variant="ghost" className="gap-2 group">
              <Link href="/servers">
                View all
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          {/* Bento Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
            {servers.slice(0, 2).map((server, i) => (
              <Link
                key={server.id}
                href={`/servers/${server.slug}`}
                className={i === 0 ? "lg:col-span-2 lg:row-span-2" : ""}
              >
                <GlassCard
                  glow="cyan"
                  className={`h-full flex flex-col ${i === 0 ? "min-h-[400px]" : ""}`}
                >
                  <GlassCardHeader className="flex-none">
                    <div className="flex items-start justify-between gap-4">
                      <GlassCardTitle className={i === 0 ? "text-2xl" : ""}>
                        {server.name}
                      </GlassCardTitle>
                      {(server.starsCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                          <Star className="h-4 w-4" />
                          <span className="text-sm">{server.starsCount?.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </GlassCardHeader>
                  <GlassCardContent className="flex-1 flex flex-col">
                    <p className={`text-muted-foreground ${i === 0 ? "text-base line-clamp-4" : "text-sm line-clamp-2"} mb-4`}>
                      {server.description}
                    </p>

                    {server.installCommand && (
                      <div className="mt-auto">
                        <code className="block px-3 py-2 bg-black/40 rounded-lg text-xs font-mono truncate text-cyan/90 border border-[var(--glass-border)]">
                          {server.installCommand}
                        </code>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--glass-border)]">
                      {(server.tools as { name: string }[])?.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Wrench className="h-3 w-3" />
                          <span>{(server.tools as { name: string }[]).length} tools</span>
                        </div>
                      )}
                      {server.discoveredSources?.includes("github") && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <GitFork className="h-3 w-3" />
                          <span>GitHub</span>
                        </div>
                      )}
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </Link>
            ))}

            {servers.slice(2, 6).map((server) => (
              <Link key={server.id} href={`/servers/${server.slug}`}>
                <GlassCard glow="none" className="h-full">
                  <GlassCardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <GlassCardTitle className="text-base">{server.name}</GlassCardTitle>
                      {(server.starsCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                          <Star className="h-3.5 w-3.5" />
                          <span className="text-xs">{server.starsCount?.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {server.description}
                    </p>
                  </GlassCardContent>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why MCP Section */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/5 to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Why <GradientText variant="cyan-purple">MCP</GradientText>?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Model Context Protocol is the open standard for AI integrations
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            <GlassCard glow="none" className="text-center">
              <GlassCardContent className="pt-8 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/20 to-cyan/5 flex items-center justify-center mx-auto mb-6">
                  <Zap className="h-7 w-7 text-cyan" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Extend AI Capabilities</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your AI to databases, APIs, file systems, and custom tools
                </p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard glow="none" className="text-center">
              <GlassCardContent className="pt-8 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple/20 to-purple/5 flex items-center justify-center mx-auto mb-6">
                  <Box className="h-7 w-7 text-purple" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Community Ecosystem</h3>
                <p className="text-sm text-muted-foreground">
                  8000+ community-built servers ready to use in your projects
                </p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard glow="none" className="text-center">
              <GlassCardContent className="pt-8 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green/20 to-green/5 flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-7 w-7 text-green" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Secure by Design</h3>
                <p className="text-sm text-muted-foreground">
                  Run servers locally with full control over permissions and data
                </p>
              </GlassCardContent>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Browse by Category</h2>
              <p className="text-muted-foreground">Find servers for your specific use case</p>
            </div>
            <Button asChild variant="ghost" className="gap-2 group">
              <Link href="/categories">
                All categories
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 6).map((category) => {
              const Icon = CATEGORY_ICONS[category.slug] ?? Package;
              const gradientClass = CATEGORY_COLORS[category.slug] ?? "from-cyan/20 to-purple/20";

              return (
                <Link key={category.id} href={`/categories/${category.slug}`}>
                  <GlassCard hover className="h-full group relative overflow-hidden">
                    {/* Gradient background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                    <GlassCardContent className="relative z-10 py-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-white/10 to-white/5 shrink-0">
                          <Icon className="h-6 w-6 text-cyan" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold mb-1 group-hover:text-cyan transition-colors">
                            {category.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {category.description}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan/10 via-purple/10 to-cyan/10" />
        <GridPattern />
        <div className="container mx-auto px-4 relative z-10">
          <GlassCard glow="gradient" className="max-w-4xl mx-auto text-center">
            <GlassCardContent className="py-16 px-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to extend your AI?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Explore the full catalog of MCP servers and find the perfect integration for your project.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="h-12 px-8 text-base rounded-xl bg-gradient-to-r from-cyan to-purple hover:opacity-90 transition-opacity">
                  <Link href="/servers">
                    Explore Servers
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base rounded-xl glass border-[var(--glass-border)] hover:bg-white/5">
                  <Link href="https://github.com/modelcontextprotocol" target="_blank" rel="noopener noreferrer">
                    <GitFork className="mr-2 h-5 w-5" />
                    GitHub
                  </Link>
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
