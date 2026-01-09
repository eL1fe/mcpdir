import { db } from "@/lib/db";
import { servers, serverCategories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchRepoMetadata, isGitHubError } from "@/lib/github";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name);

  // Check if slug exists
  const existing = await db.query.servers.findFirst({
    where: eq(servers.slug, baseSlug),
    columns: { id: true },
  });

  if (!existing) {
    return baseSlug;
  }

  // Find unique slug with counter
  let counter = 2;
  while (true) {
    const slug = `${baseSlug}-${counter}`;
    const exists = await db.query.servers.findFirst({
      where: eq(servers.slug, slug),
      columns: { id: true },
    });
    if (!exists) {
      return slug;
    }
    counter++;
    if (counter > 100) {
      // Safety limit
      return `${baseSlug}-${Date.now()}`;
    }
  }
}

interface IndexSubmissionParams {
  githubUrl: string;
  repoOwner: string;
  repoName: string;
  name: string;
  description: string | null;
  starsCount: number | null;
  categoryIds: string[];
}

interface IndexResult {
  success: boolean;
  serverId?: string;
  slug?: string;
  error?: string;
}

export async function indexServerFromSubmission(
  params: IndexSubmissionParams
): Promise<IndexResult> {
  const { githubUrl, repoOwner, repoName, name, description, starsCount, categoryIds } = params;

  try {
    // Fetch fresh metadata from GitHub
    const metadata = await fetchRepoMetadata(repoOwner, repoName);

    if (isGitHubError(metadata)) {
      return { success: false, error: metadata.message };
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(name);

    // Create server entry
    const [server] = await db
      .insert(servers)
      .values({
        name: metadata.name || name,
        slug,
        description: metadata.description || description,
        sourceType: "github",
        sourceUrl: metadata.htmlUrl,
        starsCount: metadata.starsCount ?? starsCount ?? 0,
        forksCount: metadata.forksCount ?? 0,
        discoveredSources: ["user-submission"],
        validationStatus: "pending",
      })
      .returning();

    // Link categories
    if (categoryIds.length > 0) {
      await db.insert(serverCategories).values(
        categoryIds.map((categoryId) => ({
          serverId: server.id,
          categoryId,
        }))
      );
    }

    return {
      success: true,
      serverId: server.id,
      slug: server.slug,
    };
  } catch (error) {
    console.error("Failed to index server from submission:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
