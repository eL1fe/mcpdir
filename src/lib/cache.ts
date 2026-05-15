export const CACHE_CONTROL = {
  short: "public, s-maxage=300, stale-while-revalidate=3600",
  medium: "public, s-maxage=3600, stale-while-revalidate=86400",
  long: "public, s-maxage=86400, stale-while-revalidate=604800",
  week: "public, s-maxage=604800, stale-while-revalidate=604800",
} as const;
