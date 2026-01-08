"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServerPreview } from "@/lib/db/queries";

interface SearchCommandProps {
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  size?: "default" | "large";
}

export function SearchCommand({
  placeholder = "Search MCP servers...",
  className,
  autoFocus = false,
  size = "default",
}: SearchCommandProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ServerPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Fetch preview results
  useEffect(() => {
    abortRef.current?.abort();

    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/servers/preview?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setResults(data.results);
        setSelectedIndex(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          console.error("Search error:", e);
        }
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global ⌘K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigateToServer = useCallback(
    (slug: string) => {
      setIsOpen(false);
      router.push(`/servers/${slug}`);
    },
    [router]
  );

  const handleSubmit = useCallback(() => {
    if (selectedIndex >= 0 && results[selectedIndex]) {
      navigateToServer(results[selectedIndex].slug);
    } else if (query.trim()) {
      setIsOpen(false);
      router.push(`/servers?q=${encodeURIComponent(query.trim())}`);
    }
  }, [selectedIndex, results, query, navigateToServer, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        handleSubmit();
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const formatStars = (count: number | null) => {
    if (!count) return null;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Input */}
      <div className="relative group">
        <Search className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-colors group-focus-within:text-cyan",
          size === "large" ? "h-6 w-6" : "h-5 w-5"
        )} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            "w-full rounded-xl border border-[var(--glass-border)] bg-background/50 backdrop-blur-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan/50",
            "transition-all duration-200",
            size === "large" ? "h-14 pl-14 pr-24 text-lg" : "h-12 pl-12 pr-20 text-base"
          )}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-cyan" />}
          <kbd className={cn(
            "hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--glass-border)] bg-muted/50 px-2 text-xs text-muted-foreground",
            size === "large" ? "h-7" : "h-6"
          )}>
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-2 rounded-xl",
            "bg-card border border-[var(--glass-border)]",
            "shadow-2xl shadow-black/40 z-[100]",
            "animate-in fade-in-0 slide-in-from-top-2 duration-200",
            "max-h-[70vh] overflow-y-auto"
          )}
        >
          {results.length > 0 ? (
            <ul className="py-2">
              {results.map((server, index) => (
                <li key={server.slug}>
                  <button
                    onClick={() => navigateToServer(server.slug)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full px-4 py-3 text-left flex items-start gap-3 transition-all duration-150",
                      selectedIndex === index
                        ? "bg-cyan/10 border-l-2 border-cyan"
                        : "border-l-2 border-transparent hover:bg-white/5"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-2">
                        {server.name}
                        {selectedIndex === index && (
                          <ArrowRight className="h-3.5 w-3.5 text-cyan" />
                        )}
                      </div>
                      {server.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {server.description}
                        </div>
                      )}
                    </div>
                    {server.starsCount !== null && server.starsCount > 0 && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                        <Star className="h-3.5 w-3.5 text-yellow-500" />
                        <span>{formatStars(server.starsCount)}</span>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : !isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No servers found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : null}

          {query.trim() && (
            <div className="border-t border-[var(--glass-border)] px-4 py-3">
              <button
                onClick={handleSubmit}
                className="w-full text-left text-sm text-muted-foreground hover:text-cyan transition-colors flex items-center gap-2"
              >
                <kbd className="rounded-md border border-[var(--glass-border)] bg-muted/50 px-1.5 py-0.5 text-xs">↵</kbd>
                <span>Search all results for &ldquo;{query}&rdquo;</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
