"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:bg-zinc-800 prose-code:text-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              loading="lazy"
              className="rounded-lg max-w-full h-auto"
              {...props}
            />
          ),
          a: ({ href, children, ...props }) => (
            <a
              href={href}
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
