import type { NextConfig } from "next";

const mediumCache = [
  {
    key: "Cache-Control",
    value: "public, s-maxage=3600, stale-while-revalidate=86400",
  },
];

const longCache = [
  {
    key: "Cache-Control",
    value: "public, s-maxage=86400, stale-while-revalidate=604800",
  },
];

const weekCache = [
  {
    key: "Cache-Control",
    value: "public, s-maxage=604800, stale-while-revalidate=604800",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      { source: "/", headers: mediumCache },
      { source: "/servers", headers: mediumCache },
      { source: "/servers/:slug", headers: longCache },
      { source: "/categories", headers: longCache },
      { source: "/categories/:slug", headers: longCache },
      { source: "/u/:username", headers: mediumCache },
      { source: "/og/:path*", headers: weekCache },
      { source: "/robots.txt", headers: longCache },
      { source: "/sitemap.xml", headers: longCache },
    ];
  },
};

export default nextConfig;
