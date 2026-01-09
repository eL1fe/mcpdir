"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Shield, Loader2, CheckCircle2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { VerificationMethod } from "@/lib/validations/user-features";

interface ClaimButtonProps {
  serverId: string;
  serverName: string;
  githubUrl: string | null;
  claimedBy?: string | null;
  claimedByUsername?: string | null;
}

type Step = "method" | "instructions" | "verify" | "success";

export function ClaimButton({
  serverId,
  serverName,
  githubUrl,
  claimedBy,
  claimedByUsername,
}: ClaimButtonProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<VerificationMethod>("file");
  const [claimData, setClaimData] = useState<{
    id: string;
    verificationToken: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If already claimed by someone else
  if (claimedBy && session?.user?.id !== claimedBy) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <Shield className="h-3 w-3" />
          Maintained
        </Badge>
        {claimedByUsername && (
          <span>by <Link href={`/u/${claimedByUsername}`} className="hover:text-cyan">@{claimedByUsername}</Link></span>
        )}
      </div>
    );
  }

  // If claimed by current user
  if (claimedBy && session?.user?.id === claimedBy) {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        <Shield className="h-3 w-3" />
        You maintain this server
      </Badge>
    );
  }

  // Not logged in
  if (!session?.user) {
    return (
      <Button variant="outline" size="sm" asChild className="gap-2">
        <Link href={`/auth/signin?callbackUrl=/servers/${serverId}`}>
          <Shield className="h-4 w-4" />
          Claim this server
        </Link>
      </Button>
    );
  }

  const handleInitiateClaim = async () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId, verificationMethod: method }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to initiate claim");
          return;
        }

        setClaimData({ id: data.id, verificationToken: data.verificationToken });
        setStep("instructions");
      } catch {
        setError("Failed to initiate claim. Please try again.");
      }
    });
  };

  const handleVerify = async () => {
    if (!claimData) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/claims/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId: claimData.id }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.details || data.error || "Verification failed");
          return;
        }

        setStep("success");
      } catch {
        setError("Verification failed. Please try again.");
      }
    });
  };

  const copyToken = () => {
    if (claimData?.verificationToken) {
      navigator.clipboard.writeText(claimData.verificationToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setStep("method");
        setMethod("file");
        setClaimData(null);
        setError(null);
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          Claim this server
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "success" ? (
          <div className="py-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <DialogTitle className="mb-2">Server Claimed!</DialogTitle>
            <DialogDescription>
              You are now the official maintainer of {serverName}.
            </DialogDescription>
            <Button className="mt-4" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Claim {serverName}</DialogTitle>
              <DialogDescription>
                Prove ownership to become the official maintainer
              </DialogDescription>
            </DialogHeader>

            {step === "method" && (
              <div className="space-y-4 py-4">
                <Label>Verification Method</Label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMethod("file")}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-colors",
                      method === "file"
                        ? "border-cyan bg-cyan/10"
                        : "border-[var(--glass-border)] hover:border-cyan/50"
                    )}
                  >
                    <div className="font-medium">File Verification</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Add a verification file to your repository
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("github_owner")}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-colors",
                      method === "github_owner"
                        ? "border-cyan bg-cyan/10"
                        : "border-[var(--glass-border)] hover:border-cyan/50"
                    )}
                  >
                    <div className="font-medium">GitHub Owner</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Your GitHub username must match the repository owner
                    </div>
                  </button>
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInitiateClaim} disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === "instructions" && claimData && (
              <div className="space-y-4 py-4">
                {method === "file" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Step 1: Copy the verification token</Label>
                      <div className="flex gap-2">
                        <code className="flex-1 px-3 py-2 bg-black/40 rounded-lg text-xs font-mono break-all border border-[var(--glass-border)]">
                          {claimData.verificationToken}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={copyToken}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Step 2: Create verification file</Label>
                      <p className="text-sm text-muted-foreground">
                        Create a file named <code className="px-1 py-0.5 bg-black/40 rounded text-cyan">mcp-hub-verify.txt</code> in the root of your repository with the token above as its content.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Step 3: Push to GitHub</Label>
                      <p className="text-sm text-muted-foreground">
                        Commit and push the file to your repository&apos;s default branch.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      We will check if your GitHub username (<span className="text-cyan">@{session?.user?.githubUsername}</span>) matches the owner of the repository.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Repository: <code className="px-1 py-0.5 bg-black/40 rounded text-cyan">{githubUrl}</code>
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep("method")}>
                    Back
                  </Button>
                  <Button onClick={handleVerify} disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Claim"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
