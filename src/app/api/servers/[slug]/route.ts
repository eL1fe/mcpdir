import { NextRequest, NextResponse } from "next/server";
import { getServerBySlug } from "@/lib/db/queries";

interface Context {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, context: Context) {
  const { slug } = await context.params;
  const server = await getServerBySlug(slug);

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  return NextResponse.json(server);
}
