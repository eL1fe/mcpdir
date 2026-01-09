"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Loader2, Check, X, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

interface Report {
  id: string;
  type: string;
  description: string | null;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  server: {
    id: string;
    name: string;
    slug: string;
  } | null;
  reporter: {
    id: string;
    username: string;
    name: string | null;
  } | null;
}

interface ApiResponse {
  data: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts: {
    pending: number;
    resolved: number;
    dismissed: number;
    all: number;
  };
}

const REPORT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  broken: { label: "Broken", color: "bg-red-500/20 text-red-400" },
  spam: { label: "Spam", color: "bg-orange-500/20 text-orange-400" },
  outdated: { label: "Outdated", color: "bg-yellow-500/20 text-yellow-400" },
  security: { label: "Security", color: "bg-purple-500/20 text-purple-400" },
  other: { label: "Other", color: "bg-gray-500/20 text-gray-400" },
};

export function ReportsQueue() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?status=${status}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [status]);

  const handleAction = async (id: string, action: "resolve" | "dismiss") => {
    setActionId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/reports/${id}`, {
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
            <TabsTrigger value="resolved">
              Resolved {data?.counts.resolved ? `(${data.counts.resolved})` : ""}
            </TabsTrigger>
            <TabsTrigger value="dismissed">
              Dismissed {data?.counts.dismissed ? `(${data.counts.dismissed})` : ""}
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
          No {status} reports
        </div>
      )}

      {/* Reports list */}
      {!isLoading && data?.data.map((report) => (
        <div
          key={report.id}
          className="p-4 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className={REPORT_TYPE_LABELS[report.type]?.color || ""}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {REPORT_TYPE_LABELS[report.type]?.label || report.type}
                </Badge>
                {report.server && (
                  <Link
                    href={`/servers/${report.server.slug}`}
                    className="font-medium hover:text-cyan transition-colors"
                  >
                    {report.server.name}
                  </Link>
                )}
              </div>

              {report.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {report.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {report.reporter && (
                  <span>by @{report.reporter.username}</span>
                )}
                <span>
                  {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                </span>
              </div>

              {report.resolutionNote && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  Note: {report.resolutionNote}
                </p>
              )}
            </div>

            {/* Actions */}
            {report.status === "pending" && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => handleAction(report.id, "resolve")}
                  disabled={isPending && actionId === report.id}
                  title="Resolve"
                >
                  {isPending && actionId === report.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => handleAction(report.id, "dismiss")}
                  disabled={isPending && actionId === report.id}
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {report.status !== "pending" && (
              <Badge
                variant="secondary"
                className={
                  report.status === "resolved"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-gray-500/20 text-gray-400"
                }
              >
                {report.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
