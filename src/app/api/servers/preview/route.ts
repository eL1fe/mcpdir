import { NextRequest, NextResponse } from "next/server";
import { searchServersPreview } from "@/lib/db/queries";
import { CACHE_CONTROL } from "@/lib/cache";

export const revalidate = 3600;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] }, {
      headers: { "Cache-Control": CACHE_CONTROL.short },
    });
  }

  const results = await searchServersPreview(query, 5);

  return NextResponse.json({ results }, {
    headers: { "Cache-Control": CACHE_CONTROL.short },
  });
}
