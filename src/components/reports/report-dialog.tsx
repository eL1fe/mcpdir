"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { reportTypes, type ReportType } from "@/lib/validations/user-features";

interface ReportDialogProps {
  serverId: string;
  serverName: string;
  trigger?: React.ReactNode;
}

const REPORT_TYPE_LABELS: Record<ReportType, { label: string; description: string }> = {
  broken: { label: "Broken", description: "Server doesn't work or has errors" },
  spam: { label: "Spam", description: "Not a real MCP server or promotional content" },
  outdated: { label: "Outdated", description: "Information is no longer accurate" },
  security: { label: "Security Issue", description: "Potential security vulnerability" },
  other: { label: "Other", description: "Something else not listed above" },
};

export function ReportDialog({ serverId, serverName, trigger }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serverId,
            type: selectedType,
            description: description.trim() || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to submit report");
          return;
        }

        setSuccess(true);
      } catch {
        setError("Failed to submit report. Please try again.");
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setTimeout(() => {
        setSelectedType(null);
        setDescription("");
        setError(null);
        setSuccess(false);
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Flag className="h-4 w-4 mr-2" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="py-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <DialogTitle className="mb-2">Report Submitted</DialogTitle>
            <DialogDescription>
              Thank you for helping improve the directory. Our team will review your report.
            </DialogDescription>
            <Button className="mt-4" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report an Issue</DialogTitle>
              <DialogDescription>
                Report a problem with <span className="font-medium">{serverName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Issue Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {reportTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-colors",
                        selectedType === type
                          ? "border-cyan bg-cyan/10"
                          : "border-[var(--glass-border)] hover:border-cyan/50"
                      )}
                    >
                      <div className="font-medium text-sm">
                        {REPORT_TYPE_LABELS[type].label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {REPORT_TYPE_LABELS[type].description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Details (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Provide additional details about the issue..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedType || isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
