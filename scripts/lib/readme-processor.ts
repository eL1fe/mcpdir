/**
 * Process README content to make images and links work externally.
 * Converts relative paths to absolute GitHub raw URLs.
 */
export function processReadme(
  readme: string,
  repoOwner: string,
  repoName: string,
  defaultBranch: string = "main"
): string {
  const baseUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${defaultBranch}`;

  let processed = readme;

  // Convert markdown images with relative paths: ![alt](./path) or ![alt](path)
  processed = processed.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/|data:)([^)]+)\)/g,
    (_, alt, path) => {
      const cleanPath = path.replace(/^\.\//, "");
      return `![${alt}](${baseUrl}/${cleanPath})`;
    }
  );

  // Convert HTML img tags with relative src
  processed = processed.replace(
    /<img\s+([^>]*?)src=["'](?!https?:\/\/|data:)([^"']+)["']([^>]*?)>/gi,
    (_, before, src, after) => {
      const cleanSrc = src.replace(/^\.\//, "");
      return `<img ${before}src="${baseUrl}/${cleanSrc}"${after}>`;
    }
  );

  // Convert relative links in markdown: [text](./path.md) - only for docs/images
  processed = processed.replace(
    /\[([^\]]+)\]\((?!https?:\/\/|#|mailto:)([^)]+\.(?:md|png|jpg|jpeg|gif|svg|webp))\)/gi,
    (_, text, path) => {
      const cleanPath = path.replace(/^\.\//, "");
      // For markdown files, link to GitHub blob view
      if (path.endsWith(".md")) {
        return `[${text}](https://github.com/${repoOwner}/${repoName}/blob/${defaultBranch}/${cleanPath})`;
      }
      return `[${text}](${baseUrl}/${cleanPath})`;
    }
  );

  // Fix GitHub-specific image syntax (used in some repos)
  // e.g., src="assets/screenshot.png" without leading ./
  processed = processed.replace(
    /src=["'](assets\/[^"']+)["']/gi,
    (_, path) => `src="${baseUrl}/${path}"`
  );

  // Handle <picture> tags - convert relative srcset in <source> elements
  processed = processed.replace(
    /srcset=["'](?!https?:\/\/|data:)([^"']+)["']/gi,
    (_, path) => {
      const cleanPath = path.replace(/^\.\//, "");
      return `srcset="${baseUrl}/${cleanPath}"`;
    }
  );

  // Strip <picture> tags but keep the <img> inside (already processed above)
  // This handles complex GitHub octicons that use light/dark mode switching
  processed = processed.replace(
    /<picture[^>]*>[\s\S]*?<img([^>]*)>[\s\S]*?<\/picture>/gi,
    (_, imgAttrs) => `<img${imgAttrs}>`
  );

  return processed;
}

/**
 * Extract the default branch from GitHub API response
 */
export function getDefaultBranch(repoData: { default_branch?: string }): string {
  return repoData.default_branch || "main";
}

/**
 * Parse GitHub repo URL to extract owner and repo name
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?#]+)/,
    /github\.com:([^\/]+)\/([^\.]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }

  return null;
}
