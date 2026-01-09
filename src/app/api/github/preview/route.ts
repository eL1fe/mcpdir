import { NextRequest, NextResponse } from "next/server";
import { parseGitHubUrl, fetchRepoMetadata, isGitHubError } from "@/lib/github";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
  }

  const metadata = await fetchRepoMetadata(parsed.owner, parsed.repo);

  if (isGitHubError(metadata)) {
    return NextResponse.json({ error: metadata.message }, { status: metadata.status });
  }

  return NextResponse.json(metadata);
}
