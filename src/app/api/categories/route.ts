import { NextResponse } from "next/server";
import { getCategories } from "@/lib/db/queries";
import { CACHE_CONTROL } from "@/lib/cache";

export const revalidate = 86400;

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json(categories, {
    headers: { "Cache-Control": CACHE_CONTROL.long },
  });
}
