import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submissions, servers } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { createSubmissionSchema } from "@/lib/validations/user-features";
import { parseGitHubUrl, fetchRepoMetadata, isGitHubError } from "@/lib/github";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const result = createSubmissionSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { githubUrl, categoryIds } = result.data;

  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL format" },
      { status: 400 }
    );
  }

  const { owner, repo } = parsed;

  // Check if this repo already exists as a server
  const existingServer = await db.query.servers.findFirst({
    where: or(
      eq(servers.sourceUrl, githubUrl),
      eq(servers.sourceUrl, `https://github.com/${owner}/${repo}`)
    ),
  });

  if (existingServer) {
    return NextResponse.json(
      { error: "This server already exists in our directory", slug: existingServer.slug },
      { status: 409 }
    );
  }

  // Check if there's already a pending submission for this repo
  const existingSubmission = await db.query.submissions.findFirst({
    where: eq(submissions.githubUrl, githubUrl),
  });

  if (existingSubmission) {
    if (existingSubmission.status === "pending") {
      return NextResponse.json(
        { error: "This repository already has a pending submission" },
        { status: 409 }
      );
    }
    if (existingSubmission.status === "rejected" && existingSubmission.userId !== session.user.id) {
      // Allow resubmission by original user only
      return NextResponse.json(
        { error: "This repository was previously rejected" },
        { status: 409 }
      );
    }
  }

  // Fetch repo metadata from GitHub
  const metadata = await fetchRepoMetadata(owner, repo);

  if (isGitHubError(metadata)) {
    return NextResponse.json(
      { error: metadata.message },
      { status: metadata.status }
    );
  }

  // Create submission
  const [submission] = await db
    .insert(submissions)
    .values({
      userId: session.user.id,
      githubUrl: metadata.htmlUrl,
      repoOwner: metadata.owner,
      repoName: metadata.name,
      name: metadata.name,
      description: metadata.description,
      starsCount: metadata.starsCount,
      categoryIds,
      status: "pending",
    })
    .returning();

  return NextResponse.json({
    id: submission.id,
    message: "Submission created successfully. It will be reviewed by our team.",
  });
}
