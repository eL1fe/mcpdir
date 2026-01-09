"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Check, X, ExternalLink, Star, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

interface Submission {
  id: string;
  githubUrl: string;
  repoOwner: string;
  repoName: string;
  name: string;
  description: string | null;
  starsCount: number | null;
  categoryIds: string[] | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  submitter: {
    id: string;
    username: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface ApiResponse {
  data: Submission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    all: number;
  };
}

export function SubmissionsQueue() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions?status=${status}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [status]);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActionId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/submissions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (res.ok) {
          fetchData();
        } else {
          const error = await res.json();
          alert(error.error || "Action failed");
        }
      } catch {
        alert("Action failed");
      } finally {
        setActionId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending {data?.counts.pending ? `(${data.counts.pending})` : ""}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved {data?.counts.approved ? `(${data.counts.approved})` : ""}
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected {data?.counts.rejected ? `(${data.counts.rejected})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.data.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No {status} submissions
        </div>
      )}

      {/* Submissions list */}
      {!isLoading && data?.data.map((submission) => (
        <div
          key={submission.id}
          className="p-4 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{submission.name}</h3>
                <Link
                  href={submission.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-cyan"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                {submission.starsCount && submission.starsCount > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5" />
                    {submission.starsCount.toLocaleString()}
                  </div>
                )}
              </div>

              {submission.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {submission.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {submission.submitter && (
                  <div className="flex items-center gap-1.5">
                    {submission.submitter.image && (
                      <Image
                        src={submission.submitter.image}
                        alt={submission.submitter.username}
                        width={16}
                        height={16}
                        className="rounded-full"
                      />
                    )}
                    <span>@{submission.submitter.username}</span>
                  </div>
                )}
                <span>
                  {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true })}
                </span>
              </div>

              {submission.status === "rejected" && submission.rejectionReason && (
                <p className="text-sm text-destructive mt-2">
                  Rejected: {submission.rejectionReason}
                </p>
              )}
            </div>

            {/* Actions */}
            {submission.status === "pending" && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => handleAction(submission.id, "approve")}
                  disabled={isPending && actionId === submission.id}
                >
                  {isPending && actionId === submission.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleAction(submission.id, "reject")}
                  disabled={isPending && actionId === submission.id}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {submission.status !== "pending" && (
              <Badge
                variant="secondary"
                className={
                  submission.status === "approved"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-destructive/20 text-destructive"
                }
              >
                {submission.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
