import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { serverClaims, servers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { initiateClaimSchema } from "@/lib/validations/user-features";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const result = initiateClaimSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { serverId, verificationMethod } = result.data;

  // Check if server exists
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Check if server is already claimed
  if (server.claimedBy) {
    return NextResponse.json(
      { error: "This server has already been claimed" },
      { status: 409 }
    );
  }

  // Clean up expired/rejected claims for this user+server
  await db.delete(serverClaims).where(
    and(
      eq(serverClaims.serverId, serverId),
      eq(serverClaims.userId, session.user.id),
      inArray(serverClaims.status, ["expired", "rejected"])
    )
  );

  // Check for existing pending claim by this user
  const existingClaim = await db.query.serverClaims.findFirst({
    where: and(
      eq(serverClaims.serverId, serverId),
      eq(serverClaims.userId, session.user.id),
      eq(serverClaims.status, "pending")
    ),
  });

  if (existingClaim) {
    return NextResponse.json({
      id: existingClaim.id,
      verificationToken: existingClaim.verificationToken,
      verificationMethod: existingClaim.verificationMethod,
      message: "You have an existing pending claim. Use the same verification token.",
    });
  }

  // Generate verification token
  const verificationToken = `mcphub-verify-${randomBytes(16).toString("hex")}`;

  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Create claim
  const [claim] = await db
    .insert(serverClaims)
    .values({
      serverId,
      userId: session.user.id,
      verificationMethod,
      verificationToken,
      status: "pending",
      expiresAt,
    })
    .returning();

  return NextResponse.json({
    id: claim.id,
    verificationToken: claim.verificationToken,
    verificationMethod: claim.verificationMethod,
    expiresAt: claim.expiresAt,
    serverGithubUrl: server.sourceUrl,
    message: "Claim initiated. Follow the verification steps.",
  });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { serverId } = body as { serverId: string };

  if (!serverId) {
    return NextResponse.json({ error: "serverId is required" }, { status: 400 });
  }

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  if (server.claimedBy !== session.user.id) {
    return NextResponse.json({ error: "You are not the owner of this server" }, { status: 403 });
  }

  await db.update(servers).set({
    claimedBy: null,
    claimedAt: null,
  }).where(eq(servers.id, serverId));

  await db.update(serverClaims).set({ status: "revoked" }).where(
    and(
      eq(serverClaims.serverId, serverId),
      eq(serverClaims.userId, session.user.id),
      eq(serverClaims.status, "verified")
    )
  );

  return NextResponse.json({ message: "Ownership released" });
}
