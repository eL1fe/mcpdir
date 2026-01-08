import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Package,
  Database,
  Globe,
  Wrench,
  Brain,
  CheckSquare,
  BarChart,
  MessageCircle,
  FolderOpen,
} from "lucide-react";
import { getCategoryBySlug, getServersByCategory } from "@/lib/db/queries";
import { ServerCard } from "@/components/server-card";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/ui/gradient-text";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 30;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  databases: Database,
  "file-systems": FolderOpen,
  "apis-services": Globe,
  "dev-tools": Wrench,
  "ai-ml": Brain,
  productivity: CheckSquare,
  "data-analytics": BarChart,
  communication: MessageCircle,
  other: Package,
};

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const { servers, total } = await getServersByCategory(slug, PAGE_SIZE, page);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const Icon = CATEGORY_ICONS[slug] ?? Package;

  const buildPageUrl = (pageNum: number) => {
    return `/categories/${slug}?page=${pageNum}`;
  };

  return (
    <div className="min-h-screen">
      {/* Header with gradient */}
      <div className="relative overflow-hidden border-b border-[var(--glass-border)]">
        <div className="absolute inset-0 bg-gradient-to-b from-purple/5 via-cyan/3 to-transparent" />
        <div className="container mx-auto px-4 py-8 relative z-10">
          {/* Breadcrumb */}
          <Link
            href="/categories"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-cyan transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            All categories
          </Link>

          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple/20 to-cyan/20 flex items-center justify-center shrink-0">
              <Icon className="h-8 w-8 text-purple" />
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <GradientText variant="purple-pink">{category.name}</GradientText>
              </h1>
              {category.description && (
                <p className="text-lg text-muted-foreground max-w-2xl">
                  {category.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-3">
                <span className="text-cyan font-medium">{total.toLocaleString()}</span> server{total !== 1 ? "s" : ""} in this category
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {servers.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {servers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={{
                    ...server,
                    categories: [slug],
                    tags: [],
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-[var(--glass-border)]"
                  disabled={page <= 1}
                  asChild={page > 1}
                >
                  {page > 1 ? (
                    <Link href={buildPageUrl(page - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Link>
                  ) : (
                    <span>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </span>
                  )}
                </Button>

                <div className="flex items-center gap-1 px-4">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Link
                        key={pageNum}
                        href={buildPageUrl(pageNum)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                          pageNum === page
                            ? "bg-cyan/20 text-cyan border border-cyan/30"
                            : "hover:bg-white/5 text-muted-foreground"
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-[var(--glass-border)]"
                  disabled={page >= totalPages}
                  asChild={page < totalPages}
                >
                  {page < totalPages ? (
                    <Link href={buildPageUrl(page + 1)}>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  ) : (
                    <span>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </span>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No servers yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              No servers have been added to this category yet. Check back soon!
            </p>
            <Button asChild variant="outline" className="mt-6 glass border-[var(--glass-border)]">
              <Link href="/servers">Browse all servers</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
