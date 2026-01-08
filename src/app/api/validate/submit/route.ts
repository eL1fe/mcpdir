import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { servers, manualValidations, validationAuditLog, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Security: Validate install command format and package match
function validateInstallCommand(
  command: string,
  packageName: string | null
): { valid: boolean; error?: string } {
  // Must start with npx -y or uvx
  if (!command.startsWith("npx -y ") && !command.startsWith("uvx ")) {
    return { valid: false, error: "Command must start with 'npx -y' or 'uvx'" };
  }

  // No shell operators that could be used for injection
  const dangerousPatterns = ["|", "&&", "||", ";", "`", "$(", "${", ">", "<", "\\n"];
  for (const pattern of dangerousPatterns) {
    if (command.includes(pattern)) {
      return { valid: false, error: `Command contains forbidden pattern: ${pattern}` };
    }
  }

  // If server has a package name, command must use that exact package
  if (packageName) {
    const normalizedPackage = packageName.toLowerCase();
    const normalizedCommand = command.toLowerCase();

    // For npx commands, extract package name (after npx -y)
    if (command.startsWith("npx -y ")) {
      const parts = command.slice(7).split(" ");
      const cmdPackage = parts[0]?.toLowerCase();

      // Package must be the server's registered package or scoped variant
      if (cmdPackage !== normalizedPackage && !normalizedCommand.includes(normalizedPackage)) {
        return {
          valid: false,
          error: `Install command must use the server's package: ${packageName}`,
        };
      }
    }

    // For uvx commands, extract package name
    if (command.startsWith("uvx ")) {
      const parts = command.slice(4).split(" ");
      const cmdPackage = parts[0]?.toLowerCase();

      if (cmdPackage !== normalizedPackage && !normalizedCommand.includes(normalizedPackage)) {
        return {
          valid: false,
          error: `Install command must use the server's package: ${packageName}`,
        };
      }
    }
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { serverId, installCommand } = body as {
    serverId: string;
    installCommand?: string;
  };

  if (!serverId) {
    return NextResponse.json({ error: "serverId is required" }, { status: 400 });
  }

  // Fetch server
  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverId),
  });

  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  // Determine install command to use
  const finalCommand = installCommand || server.installCommand;
  if (!finalCommand) {
    return NextResponse.json({ error: "Install command is required" }, { status: 400 });
  }

  // If custom install command provided, validate it
  if (installCommand) {
    const validation = validateInstallCommand(installCommand, server.packageName);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  // Check for existing pending submission by this user for this server
  const existingSubmission = await db.query.manualValidations.findFirst({
    where: and(
      eq(manualValidations.serverId, serverId),
      eq(manualValidations.userId, session.user.id),
      eq(manualValidations.status, "pending")
    ),
  });

  if (existingSubmission) {
    // Return existing submission so user can continue
    return NextResponse.json({
      validationId: existingSubmission.id,
      status: "pending",
      message: "Continuing existing submission",
      existing: true,
    });
  }

  // Check if user is the server owner (GitHub repo owner matches)
  let isOwner = false;
  if (server.sourceUrl) {
    // Extract owner from GitHub URL
    const match = server.sourceUrl.match(/github\.com\/([^/]+)/i);
    if (match) {
      const repoOwner = match[1].toLowerCase();
      isOwner = repoOwner === session.user.githubUsername.toLowerCase();
    }
  }

  // Create manual validation submission
  const [submission] = await db
    .insert(manualValidations)
    .values({
      serverId,
      userId: session.user.id,
      installCommand: installCommand || null, // Only store custom commands
      isOwnerSubmission: isOwner ? 1 : 0,
      status: "pending",
    })
    .returning();

  // Log the action
  await db.insert(validationAuditLog).values({
    serverId,
    userId: session.user.id,
    action: "submit",
    metadata: {
      validationId: submission.id,
      hasCustomCommand: !!installCommand,
      isOwner,
    },
  });

  return NextResponse.json({
    validationId: submission.id,
    status: "pending",
    message: "Validation request submitted. Credentials will be requested separately.",
    isOwnerSubmission: isOwner,
  });
}
