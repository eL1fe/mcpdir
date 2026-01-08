"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Github, Loader2, CheckCircle, AlertCircle, Plus, X, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";

interface HelpValidateFormProps {
  serverId: string;
  serverName: string;
  packageName: string | null;
  existingInstallCommand: string | null;
  requiredEnvVars?: string[];
}

interface EnvVar {
  key: string;
  value: string;
}

export function HelpValidateForm({
  serverId,
  serverName,
  packageName,
  existingInstallCommand,
  requiredEnvVars = [],
}: HelpValidateFormProps) {
  const { data: session, status } = useSession();
  const [step, setStep] = useState<"loading" | "form" | "credentials" | "running" | "success" | "failed">("loading");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationId, setValidationId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    toolsCount?: number;
    resourcesCount?: number;
    promptsCount?: number;
    durationMs?: number;
  } | null>(null);

  // Form state
  const [customCommand, setCustomCommand] = useState("");
  const [useCustomCommand, setUseCustomCommand] = useState(!existingInstallCommand);
  const [envVars, setEnvVars] = useState<EnvVar[]>(
    requiredEnvVars.length > 0
      ? requiredEnvVars.map((key) => ({ key, value: "" }))
      : [{ key: "", value: "" }]
  );

  // Check status helper
  const checkStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/validate/check?serverId=${serverId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.submission) {
          if (data.submission.status === "completed") {
            setStep("success");
            return "completed";
          } else if (data.submission.status === "failed") {
            setError(data.submission.validationError || "Validation failed");
            setStep("failed");
            return "failed";
          } else if (data.submission.status === "validating") {
            return "validating";
          } else if (data.submission.status === "pending") {
            setStep("credentials");
            return "pending";
          }
        }
      }
    } catch {
      // Ignore errors
    }
    return null;
  };

  // Check for existing submission on mount
  useEffect(() => {
    if (status !== "authenticated") {
      setStep("form");
      return;
    }

    const checkExisting = async () => {
      try {
        const res = await fetch(`/api/validate/check?serverId=${serverId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.submission) {
            setValidationId(data.submission.id);
            if (data.submission.status === "validating") {
              setStep("running");
            } else if (data.submission.status === "pending") {
              setStep("credentials");
            } else if (data.submission.status === "completed") {
              setStep("success");
            } else if (data.submission.status === "failed") {
              setError(data.submission.validationError || "Validation failed");
              setStep("failed");
            } else {
              setStep("form");
            }
            return;
          }
        }
      } catch {
        // Ignore errors
      }
      setStep("form");
    };

    checkExisting();
  }, [serverId, status]);

  // Poll for status when running (async validation via GitHub Actions)
  useEffect(() => {
    if (step !== "running" || !validationId) return;

    const pollInterval = setInterval(async () => {
      const status = await checkStatus(validationId);
      if (status === "completed" || status === "failed") {
        clearInterval(pollInterval);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [step, validationId, serverId]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const installCommand = useCustomCommand ? customCommand : undefined;

      const res = await fetch("/api/validate/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId, installCommand }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setValidationId(data.validationId);
      setStep("credentials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsSubmit = async () => {
    if (!validationId) return;

    setError(null);
    setStep("running");

    try {
      // Build credentials object from env vars
      const credentials: Record<string, string> = {};
      for (const { key, value } of envVars) {
        if (key && value) {
          credentials[key] = value;
        }
      }

      const res = await fetch(`/api/validate/${validationId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Credentials submission failed");
      }

      if (data.status === "completed") {
        setValidationResult(data.result);
        setStep("success");
      } else if (data.status === "failed") {
        setError(data.error || "Validation failed");
        setStep("failed");
      } else {
        // Still running or unknown status
        setStep("running");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("failed");
    }
  };

  const handleCancel = async () => {
    if (!validationId) {
      setStep("form");
      return;
    }

    setLoading(true);
    try {
      await fetch(`/api/validate/${validationId}/cancel`, { method: "POST" });
      setValidationId(null);
      setStep("form");
      setError(null);
    } catch {
      // Ignore errors, just reset form
      setValidationId(null);
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (status === "loading" || step === "loading") {
    return (
      <GlassCard className="overflow-hidden">
        <GlassCardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </GlassCardContent>
      </GlassCard>
    );
  }

  // Running state (validation in progress)
  if (step === "running") {
    return (
      <GlassCard className="overflow-hidden">
        <GlassCardContent className="py-6 text-center">
          <Loader2 className="h-10 w-10 text-cyan mx-auto mb-3 animate-spin" />
          <h3 className="font-semibold mb-2">Validating Server...</h3>
          <p className="text-sm text-muted-foreground mb-1">
            Running MCP handshake in Docker container.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            This may take up to 60 seconds.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
        </GlassCardContent>
      </GlassCard>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <GlassCard glow="cyan" className="overflow-hidden">
        <GlassCardContent className="py-6 text-center">
          <CheckCircle className="h-12 w-12 text-green mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Validation Successful!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Server has been marked as validated. Thank you for your contribution!
          </p>
          {validationResult && (
            <div className="text-xs text-muted-foreground space-y-1">
              {validationResult.toolsCount !== undefined && (
                <p>Tools: {validationResult.toolsCount}</p>
              )}
              {validationResult.durationMs !== undefined && (
                <p>Duration: {(validationResult.durationMs / 1000).toFixed(1)}s</p>
              )}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    );
  }

  // Failed state
  if (step === "failed") {
    return (
      <GlassCard className="overflow-hidden">
        <GlassCardContent className="py-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Validation Failed</h3>
          {error && (
            <p className="text-sm text-red-400 mb-4 break-words">{error}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              setValidationId(null);
              setStep("form");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Try Again
          </Button>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (!session) {
    return (
      <GlassCard className="overflow-hidden">
        <GlassCardHeader>
          <GlassCardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-yellow-400" />
            Help Validate
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This server requires configuration to validate. Sign in with GitHub to help.
          </p>
          <Button asChild className="w-full bg-[#24292f] hover:bg-[#24292f]/90">
            <Link href="/auth/signin">
              <Github className="h-4 w-4 mr-2" />
              Sign in with GitHub
            </Link>
          </Button>
        </GlassCardContent>
      </GlassCard>
    );
  }


  // Credentials step
  if (step === "credentials") {
    return (
      <GlassCard className="overflow-hidden">
        <GlassCardHeader>
          <GlassCardTitle className="text-base">Credentials</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Enter env vars for this server. <strong>Not stored</strong> — only used for validation.
          </p>

          {error && (
            <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            {envVars.map((env, index) => (
              <div key={index} className="space-y-1">
                <div className="flex gap-1">
                  <Input
                    placeholder="KEY"
                    value={env.key}
                    onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                    className="flex-1 bg-background/50 border-[var(--glass-border)] font-mono text-xs h-8"
                  />
                  {envVars.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvVar(index)}
                      className="shrink-0 h-8 w-8"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="value"
                  value={env.value}
                  onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                  className="w-full bg-background/50 border-[var(--glass-border)] text-xs h-8"
                />
              </div>
            ))}

            <Button
              variant="ghost"
              size="sm"
              onClick={addEnvVar}
              className="w-full text-xs text-muted-foreground hover:text-foreground h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/60 mt-2">
            e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY
          </p>

          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={handleCredentialsSubmit}
              disabled={loading || envVars.every((e) => !e.key || !e.value)}
              className="w-full bg-gradient-to-r from-cyan/80 to-purple/80 hover:from-cyan hover:to-purple"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={loading}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  // Initial form
  return (
    <GlassCard className="overflow-hidden">
      <GlassCardHeader>
        <GlassCardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-yellow-400" />
          Help Validate
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Help validate <strong>{serverName}</strong> by providing the required configuration.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {existingInstallCommand && (
          <div className="mb-4">
            <Label className="text-sm">Install Command</Label>
            <code className="block mt-1 px-3 py-2 bg-background/50 rounded-lg text-xs font-mono text-muted-foreground break-all overflow-hidden">
              {existingInstallCommand}
            </code>
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={useCustomCommand}
                onChange={(e) => setUseCustomCommand(e.target.checked)}
                className="rounded border-[var(--glass-border)]"
              />
              <span className="text-muted-foreground">Use a different command</span>
            </label>
          </div>
        )}

        {useCustomCommand && (
          <div className="mb-4">
            <Label htmlFor="customCommand" className="text-sm">
              Custom Install Command
            </Label>
            <Input
              id="customCommand"
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              placeholder={`npx -y ${packageName || "@package/name"}`}
              className="mt-1 bg-background/50 border-[var(--glass-border)] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must start with &quot;npx -y&quot; or &quot;uvx&quot;
              {packageName && ` and use ${packageName}`}
            </p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading || (useCustomCommand && !customCommand)}
          className="w-full bg-gradient-to-r from-cyan/80 to-purple/80 hover:from-cyan hover:to-purple"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Continue
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Signed in as <strong>@{session.user.githubUsername}</strong>
        </p>
      </GlassCardContent>
    </GlassCard>
  );
}
