import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { searchServers, getCategories, getPopularServers, SortOption } from "@/lib/db/queries";
import { ServerList } from "@/components/server-list";
import { SearchCommand } from "@/components/search-command";
import { FilterBar } from "@/components/filter-bar";
import { NoResultsState } from "@/components/no-results-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/ui/gradient-text";

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    tags?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ServersPage({ searchParams }: Props) {
  const params = await searchParams;

  const query = params.q;
  const categorySlug = params.category;
  const tagSlugs = params.tags?.split(",").filter(Boolean);
  const sort = (params.sort as SortOption) || (query ? "relevance" : "stars");
  const page = parseInt(params.page ?? "1", 10);

  const [result, categories, popularServers] = await Promise.all([
    searchServers({
      query,
      categorySlug,
      tagSlugs,
      sort,
      order: "desc",
      page,
      limit: 30,
    }),
    getCategories(),
    getPopularServers(6),
  ]);

  const { servers, total, totalPages } = result;

  const buildPageUrl = (pageNum: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (categorySlug) params.set("category", categorySlug);
    if (tagSlugs?.length) params.set("tags", tagSlugs.join(","));
    if (sort !== "stars") params.set("sort", sort);
    params.set("page", String(pageNum));
    return `/servers?${params.toString()}`;
  };

  return (
    <div className="min-h-screen">
      {/* Header section with gradient background */}
      <div className="relative overflow-hidden border-b border-[var(--glass-border)]">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-12 relative z-10">
          <h1 className="text-4xl font-bold mb-3">
            {query ? (
              <>
                Search: <GradientText variant="cyan-purple">{query}</GradientText>
              </>
            ) : (
              <>All <GradientText variant="cyan-purple">MCP Servers</GradientText></>
            )}
          </h1>
          <p className="text-lg text-muted-foreground">
            {query
              ? `Found ${total.toLocaleString()} servers matching your search`
              : `Browse ${total.toLocaleString()} community-built MCP servers`}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search and filters */}
        <div className="glass rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Suspense fallback={<Skeleton className="h-12 w-full rounded-xl" />}>
                <SearchCommand
                  placeholder="Search servers by name, description, or tools..."
                  className="[&_input]:bg-background/50 [&_input]:border-0 [&_input]:rounded-xl"
                />
              </Suspense>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
            <Suspense fallback={<Skeleton className="h-12 w-full" />}>
              <FilterBar categories={categories} />
            </Suspense>
          </div>
        </div>

        {/* Results */}
        {servers.length > 0 ? (
          <>
            <ServerList servers={servers} />

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
          <NoResultsState
            query={query}
            popularServers={popularServers}
            categories={categories}
          />
        )}
      </div>
    </div>
  );
}
