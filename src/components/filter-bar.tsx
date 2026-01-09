"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/db/schema";

interface FilterBarProps {
  categories: Category[];
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance", searchOnly: true },
  { value: "stars", label: "Stars", searchOnly: false },
  { value: "updated", label: "Updated", searchOnly: false },
  { value: "name", label: "Name", searchOnly: false },
] as const;

export function FilterBar({ categories }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get("category");
  const hasQuery = !!searchParams.get("q");
  // Default sort is "relevance" when searching, "stars" otherwise
  const currentSort = searchParams.get("sort") || (hasQuery ? "relevance" : "stars");

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      // Reset page on filter change
      params.delete("page");

      startTransition(() => {
        router.push(`/servers?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  const clearAll = () => {
    startTransition(() => {
      const q = searchParams.get("q");
      router.push(q ? `/servers?q=${encodeURIComponent(q)}` : "/servers", { scroll: false });
    });
  };

  const defaultSort = hasQuery ? "relevance" : "stars";
  const hasFilters = currentCategory || currentSort !== defaultSort;

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!currentCategory ? "default" : "outline"}
          size="sm"
          onClick={() => updateParams({ category: null })}
          disabled={isPending}
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.slug}
            variant={currentCategory === cat.slug ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams({ category: currentCategory === cat.slug ? null : cat.slug })}
            disabled={isPending}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort:</span>
        {SORT_OPTIONS.filter((opt) => !opt.searchOnly || hasQuery).map((opt) => (
          <Button
            key={opt.value}
            variant={currentSort === opt.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => updateParams({ sort: opt.value })}
            disabled={isPending}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Active filters */}
      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {currentCategory && (
            <Badge variant="secondary" className="gap-1">
              {categories.find((c) => c.slug === currentCategory)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateParams({ category: null })}
              />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={isPending}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
