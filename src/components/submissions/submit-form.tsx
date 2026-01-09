"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, CheckCircle2 } from "lucide-react";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GitHubPreview } from "./github-preview";
import type { GitHubRepoMetadata } from "@/lib/github";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface SubmitFormProps {
  categories: Category[];
}

type Step = "url" | "categories" | "confirm";

export function SubmitForm({ categories }: SubmitFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("url");

  const [githubUrl, setGithubUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<GitHubRepoMetadata | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValidUrl = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(githubUrl);

  const handleFetchMetadata = async () => {
    if (!isValidUrl) return;

    setUrlError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/github/preview?url=${encodeURIComponent(githubUrl)}`);
        const data = await res.json();

        if (!res.ok) {
          setUrlError(data.error || "Failed to fetch repository info");
          return;
        }

        setMetadata(data);
        setStep("categories");
      } catch {
        setUrlError("Failed to fetch repository info");
      }
    });
  };

  const handleToggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : prev.length < 5
          ? [...prev, categoryId]
          : prev
    );
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0) return;

    setSubmitError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubUrl,
            categoryIds: selectedCategories,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.slug) {
            setSubmitError(`This server already exists. View it at /servers/${data.slug}`);
          } else {
            setSubmitError(data.error || "Failed to submit");
          }
          return;
        }

        setSuccess(true);
      } catch {
        setSubmitError("Failed to submit. Please try again.");
      }
    });
  };

  if (success) {
    return (
      <GlassCard glow="cyan">
        <GlassCardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Submission Received!</h2>
          <p className="text-muted-foreground mb-6">
            Thank you for submitting your MCP server. Our team will review it shortly.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.push("/")}>
              Back to Home
            </Button>
            <Button
              onClick={() => {
                setSuccess(false);
                setStep("url");
                setGithubUrl("");
                setMetadata(null);
                setSelectedCategories([]);
              }}
            >
              Submit Another
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: GitHub URL */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan/20 text-cyan text-sm">
              1
            </span>
            GitHub Repository URL
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-url">Repository URL</Label>
            <div className="flex gap-2">
              <Input
                id="github-url"
                placeholder="https://github.com/owner/repo"
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  setUrlError(null);
                }}
                disabled={step !== "url"}
              />
              {step === "url" && (
                <Button
                  onClick={handleFetchMetadata}
                  disabled={!isValidUrl || isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {urlError && (
              <p className="text-sm text-destructive">{urlError}</p>
            )}
            {!isValidUrl && githubUrl.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)
              </p>
            )}
          </div>

          {metadata && (
            <div className="pt-2">
              <GitHubPreview metadata={metadata} />
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Step 2: Categories */}
      {(step === "categories" || step === "confirm") && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan/20 text-cyan text-sm">
                2
              </span>
              Select Categories
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select 1-5 categories that best describe your MCP server.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedCategories.includes(category.id)
                      ? "border-cyan bg-cyan/10"
                      : "border-[var(--glass-border)] hover:border-cyan/50"
                    }
                    ${selectedCategories.length >= 5 && !selectedCategories.includes(category.id)
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                    }
                  `}
                >
                  <Checkbox
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={() => handleToggleCategory(category.id)}
                    disabled={
                      selectedCategories.length >= 5 &&
                      !selectedCategories.includes(category.id)
                    }
                  />
                  <span className="text-sm">{category.name}</span>
                </label>
              ))}
            </div>
            {selectedCategories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Please select at least one category.
              </p>
            )}
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Submit */}
      {step === "categories" && selectedCategories.length > 0 && (
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => {
              setStep("url");
              setMetadata(null);
            }}
          >
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Server"
            )}
          </Button>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-destructive text-center">{submitError}</p>
      )}
    </div>
  );
}
