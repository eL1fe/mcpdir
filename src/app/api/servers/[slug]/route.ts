import { NextResponse } from "next/server";
import { getServerBySlug } from "@/lib/db/queries";
import { CACHE_CONTROL } from "@/lib/cache";

export const revalidate = 86400;
export const dynamic = "force-static";
export const dynamicParams = true;

interface Context {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const server = await getServerBySlug(slug);

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  return NextResponse.json(server, {
    headers: { "Cache-Control": CACHE_CONTROL.long },
  });
}
