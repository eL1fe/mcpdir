// GitHub API helpers

export interface GitHubRepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  starsCount: number;
  forksCount: number;
  language: string | null;
  topics: string[];
  license: string | null;
  htmlUrl: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubError {
  message: string;
  status: number;
}

const GITHUB_API_BASE = "https://api.github.com";

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function fetchRepoMetadata(
  owner: string,
  repo: string
): Promise<GitHubRepoMetadata | GitHubError> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getHeaders(),
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { message: "Repository not found", status: 404 };
      }
      if (response.status === 403) {
        return { message: "Rate limit exceeded. Try again later.", status: 403 };
      }
      return { message: `GitHub API error: ${response.status}`, status: response.status };
    }

    const data = await response.json();

    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      starsCount: data.stargazers_count,
      forksCount: data.forks_count,
      language: data.language,
      topics: data.topics || [],
      license: data.license?.spdx_id || null,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Failed to fetch repository",
      status: 500,
    };
  }
}

export function isGitHubError(result: GitHubRepoMetadata | GitHubError): result is GitHubError {
  return "status" in result && "message" in result && !("owner" in result);
}

export async function checkFileExists(
  owner: string,
  repo: string,
  path: string
): Promise<{ exists: boolean; content?: string }> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`,
      { headers: getHeaders() }
    );

    if (!response.ok) {
      return { exists: false };
    }

    const data = await response.json();
    if (data.content && data.encoding === "base64") {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { exists: true, content };
    }

    return { exists: true };
  } catch {
    return { exists: false };
  }
}

export async function getRepoOwnerUsername(owner: string, repo: string): Promise<string | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getHeaders(),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.owner.login;
  } catch {
    return null;
  }
}
