"use client";

import Link from "next/link";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerCard } from "./server-card";
import type { ServerWithRelations } from "@/types";
import type { Category } from "@/lib/db/schema";

interface NoResultsStateProps {
  query?: string;
  popularServers: ServerWithRelations[];
  categories: Category[];
}

export function NoResultsState({ query, popularServers, categories }: NoResultsStateProps) {
  return (
    <div className="py-12">
      {/* Main message */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No servers found</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          {query
            ? `No servers match "${query}". Try different keywords or browse categories below.`
            : "No servers match your filters. Try adjusting your selection or explore popular servers."}
        </p>
        <Button asChild variant="outline" className="mt-6 glass border-[var(--glass-border)]">
          <Link href="/servers">Clear all filters</Link>
        </Button>
      </div>

      {/* Browse categories */}
      {categories.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-cyan" />
            <h4 className="font-semibold">Browse by category</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 8).map((category) => (
              <Button
                key={category.slug}
                asChild
                variant="outline"
                size="sm"
                className="glass border-[var(--glass-border)] hover:border-cyan/50"
              >
                <Link href={`/servers?category=${category.slug}`}>
                  {category.name}
                </Link>
              </Button>
            ))}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href="/categories">
                All categories
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Popular servers */}
      {popularServers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-purple" />
            <h4 className="font-semibold">Popular servers</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularServers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
