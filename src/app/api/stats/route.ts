import { NextResponse } from "next/server";
import { getStats } from "@/lib/db/queries";
import { CACHE_CONTROL } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getStats();
  return NextResponse.json(stats, {
    headers: { "Cache-Control": CACHE_CONTROL.medium },
  });
}
