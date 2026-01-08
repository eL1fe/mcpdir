import { NextRequest, NextResponse } from "next/server";
import { searchServersPreview } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchServersPreview(query, 5);

  return NextResponse.json({ results });
}
