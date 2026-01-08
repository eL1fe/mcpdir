import { NextRequest, NextResponse } from "next/server";
import { searchServers, trackSearch, SortOption } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : undefined;
  const sort = (searchParams.get("sort") as SortOption) || (query ? "relevance" : "stars");
  const order = (searchParams.get("order") as "asc" | "desc") ?? "desc";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const result = await searchServers({
    query,
    categorySlug: category,
    tagSlugs: tags,
    sort,
    order,
    page,
    limit,
  });

  // Track search query (fire and forget)
  if (query) {
    trackSearch({
      query,
      resultsCount: result.total,
      category,
      tags: tags?.join(","),
    }).catch(() => {});
  }

  return NextResponse.json({
    data: result.servers,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
}
