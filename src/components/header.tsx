"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { href: "/servers", label: "Servers" },
    { href: "/categories", label: "Categories" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled
          ? "glass border-b border-[var(--glass-border)] shadow-lg"
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan to-purple rounded-lg blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative p-2 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 border border-[var(--glass-border)]">
              <Sparkles className="h-5 w-5 text-cyan" />
            </div>
          </div>
          <span className="font-bold text-lg tracking-tight">MCP Hub</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "text-cyan bg-cyan/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="https://modelcontextprotocol.io"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </Link>
          <Link
            href="https://github.com/modelcontextprotocol"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan/20 to-purple/20 border border-[var(--glass-border)] hover:from-cyan/30 hover:to-purple/30 transition-colors"
          >
            GitHub
          </Link>
          <div className="h-5 w-px bg-[var(--glass-border)]" />
          <UserMenu />
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass border-t border-[var(--glass-border)] animate-fade-in">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "text-cyan bg-cyan/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-[var(--glass-border)] my-2" />
            <Link
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/modelcontextprotocol"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              GitHub
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
