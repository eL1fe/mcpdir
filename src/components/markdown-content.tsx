"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  baseUrl?: string; // GitHub repo URL for resolving relative links
}

function resolveUrl(href: string | undefined, baseUrl?: string): string | undefined {
  if (!href) return href;

  // Already absolute URL
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    return href;
  }

  // Anchor links - keep as is
  if (href.startsWith("#")) {
    return href;
  }

  // Relative URL - resolve against GitHub base
  if (baseUrl) {
    // Remove trailing slash from baseUrl
    const base = baseUrl.replace(/\/$/, "");
    // Remove leading ./ from href
    const path = href.replace(/^\.\//, "");
    // For GitHub, use /blob/main/ or /tree/main/ for directories
    return `${base}/tree/main/${path}`;
  }

  return href;
}

export function MarkdownContent({ content, baseUrl }: MarkdownContentProps) {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:bg-zinc-800 prose-code:text-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          img: ({ src, alt, ...props }) => {
            const resolvedSrc = resolveUrl(typeof src === "string" ? src : undefined, baseUrl);
            // For images, use raw.githubusercontent.com
            const imageSrc = resolvedSrc?.replace(
              /github\.com\/([^/]+)\/([^/]+)\/tree\/main\//,
              "raw.githubusercontent.com/$1/$2/main/"
            );
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt={alt || ""}
                loading="lazy"
                className="rounded-lg max-w-full h-auto"
                {...props}
              />
            );
          },
          a: ({ href, children, ...props }) => (
            <a
              href={resolveUrl(href, baseUrl)}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          pre: ({ children, ...props }) => (
            <pre className="overflow-x-auto" {...props}>
              {children}
            </pre>
          ),
          td: ({ style, children, className }) => (
            <td style={style} className={className}>{children}</td>
          ),
          th: ({ style, children, className }) => (
            <th style={style} className={className}>{children}</th>
          ),
          tr: ({ style, children, className }) => (
            <tr style={style} className={className}>{children}</tr>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
