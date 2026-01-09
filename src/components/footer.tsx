import Link from "next/link";
import { Github, ExternalLink, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-[var(--glass-border)] bg-background/50 backdrop-blur-sm">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan/2 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-cyan" />
            </div>
            <div>
              <p className="text-sm font-medium">MCP Hub</p>
              <p className="text-xs text-muted-foreground">
                The definitive MCP server directory
              </p>
            </div>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-cyan transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              MCP Docs
            </Link>
            <Link
              href="https://github.com/modelcontextprotocol/servers"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-cyan transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </Link>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 pt-6 border-t border-[var(--glass-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>Built for the AI developer community</p>
          <p className="flex items-center gap-1">
            Indexing
            <span className="text-cyan font-medium">8,000+</span>
            MCP servers worldwide
          </p>
        </div>
      </div>
    </footer>
  );
}
