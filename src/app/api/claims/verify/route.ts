import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serverClaims, servers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyClaimSchema } from "@/lib/validations/user-features";
import { checkFileExists, parseGitHubUrl, getRepoOwnerUsername } from "@/lib/github";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const result = verifyClaimSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { claimId } = result.data;

  // Get claim
  const claim = await db.query.serverClaims.findFirst({
    where: and(
      eq(serverClaims.id, claimId),
      eq(serverClaims.userId, session.user.id)
    ),
  });

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.status !== "pending") {
    return NextResponse.json(
      { error: `Claim is already ${claim.status}` },
      { status: 400 }
    );
  }

  // Check if claim has expired
  if (claim.expiresAt && new Date(claim.expiresAt) < new Date()) {
    await db
      .update(serverClaims)
      .set({ status: "expired" })
      .where(eq(serverClaims.id, claimId));

    return NextResponse.json({ error: "Claim has expired" }, { status: 400 });
  }

  // Get server and user info
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, claim.serverId),
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Check if server was claimed by someone else in the meantime
  if (server.claimedBy) {
    await db
      .update(serverClaims)
      .set({ status: "rejected" })
      .where(eq(serverClaims.id, claimId));

    return NextResponse.json(
      { error: "This server has already been claimed by another user" },
      { status: 409 }
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const githubUrl = server.sourceUrl;
  if (!githubUrl) {
    return NextResponse.json(
      { error: "Server does not have a GitHub URL" },
      { status: 400 }
    );
  }

  const parsed = parseGitHubUrl(githubUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub URL for this server" },
      { status: 400 }
    );
  }

  let verified = false;

  if (claim.verificationMethod === "file") {
    // Check for verification file in repo
    const fileCheck = await checkFileExists(
      parsed.owner,
      parsed.repo,
      "mcp-hub-verify.txt"
    );

    if (fileCheck.exists && fileCheck.content?.includes(claim.verificationToken)) {
      verified = true;
    }
  } else if (claim.verificationMethod === "github_owner") {
    // Check if user's GitHub username matches repo owner
    const repoOwner = await getRepoOwnerUsername(parsed.owner, parsed.repo);
    if (repoOwner && user?.githubUsername?.toLowerCase() === repoOwner.toLowerCase()) {
      verified = true;
    }
  }

  if (!verified) {
    return NextResponse.json({
      error: "Verification failed",
      details:
        claim.verificationMethod === "file"
          ? "Could not find the verification file with the correct token. Make sure you created `mcp-hub-verify.txt` in the repository root with the verification token."
          : "Your GitHub username does not match the repository owner.",
    });
  }

  // Mark claim as verified and update server
  await db.transaction(async (tx) => {
    await tx
      .update(serverClaims)
      .set({
        status: "verified",
        verifiedAt: new Date(),
      })
      .where(eq(serverClaims.id, claimId));

    await tx
      .update(servers)
      .set({
        claimedBy: session.user.id,
        claimedAt: new Date(),
      })
      .where(eq(servers.id, claim.serverId));
  });

  return NextResponse.json({
    message: "Verification successful! You are now the maintainer of this server.",
    serverId: claim.serverId,
  });
}
