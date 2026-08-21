import type { Metadata } from "next";
import { SITE_CONFIG, SITE_URL } from "./constants";

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  type?: "website" | "article";
  keywords?: string[];
  noIndex?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  imagePath = "/og/default",
  type = "website",
  keywords,
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const url = new URL(path, `${SITE_URL}/`).toString();
  const image = new URL(imagePath, `${SITE_URL}/`).toString();
  const socialTitle = `${title} | ${SITE_CONFIG.name}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type,
      title: socialTitle,
      description,
      url,
      siteName: SITE_CONFIG.name,
      locale: SITE_CONFIG.locale,
      images: [{ url: image, width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image],
    },
    ...(noIndex && { robots: { index: false, follow: true } }),
  };
}
