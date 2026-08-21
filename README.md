<div align="center">

# MCP Hub

### The Largest Open MCP Server Directory

**Community-driven MCP servers. Open-source, fully searchable, zero vendor lock-in.**

<br />

[🌐 **Live Demo** → mcpdir.dev](https://mcpdir.dev)

<br />

[![GitHub Stars](https://img.shields.io/github/stars/eL1fe/mcpdir?style=flat-square&logo=github&color=06b6d4)](https://github.com/eL1fe/mcpdir/stargazers)
[![License](https://img.shields.io/badge/license-MIT-a855f7?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-22c55e?style=flat-square)](CONTRIBUTING.md)
[![Deploy](https://img.shields.io/badge/deploy-vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

<br />

<a href="https://mcpdir.dev">
  <img src="public/preview.gif" alt="MCP Hub Preview" width="800" />
</a>

<br />

[Explore Servers](https://mcpdir.dev/servers) · [Browse Categories](https://mcpdir.dev/categories) · [Submit Server](https://mcpdir.dev/submit)

</div>

---

## What is MCP Hub?

MCP Hub is the **largest open-source directory** of **Model Context Protocol (MCP) servers** — the open standard that enables AI assistants like Claude, GPT, and others to interact with external tools, databases, and services.

Unlike closed registries, MCP Hub aggregates servers from **5+ sources** and makes them freely searchable. No walled gardens, no gatekeeping — just a community-driven index of every MCP server we can find.

<div align="center">

> **Growing server index** · **Multiple categories** · **5 data sources** · **100% open-source**

</div>

---

## Features

### Discovery & Search
- Full-text search with PostgreSQL FTS + trigram matching
- Category browsing (Databases, APIs, Dev Tools, AI/ML, etc.)
- Filter by validation status and source
- Sort by stars, updated, or relevance

### Multi-Source Indexing

We aggregate MCP servers from multiple sources to provide the most comprehensive directory:

| Source | Description | Link |
|:------:|:------------|:----:|
| **MCP Registry** | Official Model Context Protocol registry | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |
| **npm** | Node.js packages with `mcp` keyword | [npmjs.com](https://www.npmjs.com/search?q=keywords:mcp) |
| **GitHub** | Repositories with `mcp-server` topic | [github.com/topics/mcp-server](https://github.com/topics/mcp-server) |
| **Glama** | Curated MCP servers from Glama.ai | [glama.ai/mcp/servers](https://glama.ai/mcp/servers) |
| **PulseMCP** | Community MCP server directory | [pulsemcp.com](https://pulsemcp.com) |
| **PyPI** | Python packages _(coming soon)_ | — |

### Server Validation
- Docker-based validation for secure sandbox testing
- MCP handshake verification with protocol compliance
- Capability discovery — tools, resources, prompts
- Community-assisted validation for servers requiring config

### GitHub Integration
- Real-time stars & forks tracking
- Last commit timestamps
- Direct links to source repositories
- README rendering with syntax highlighting

### Developer Experience
- One-click install commands (`npx`, `uvx`)
- Tools/Resources/Prompts documentation
- Responsive glassmorphism UI
- Command palette search (`Cmd+K`)

---

## Tech Stack

| Category | Technology |
|:--------:|:-----------|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **UI** | [React 19](https://react.dev) + [Tailwind CSS 4](https://tailwindcss.com) |
| **Components** | [Radix UI](https://radix-ui.com) + [Lucide Icons](https://lucide.dev) |
| **Database** | [PostgreSQL](https://postgresql.org) via [Neon](https://neon.tech) (serverless) |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) |
| **Auth** | [NextAuth.js v5](https://authjs.dev) (GitHub OAuth) |
| **AI Parsing** | [Anthropic Claude](https://anthropic.com) |
| **Validation** | Docker containers (Node.js/Python) |

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **PostgreSQL** database (or [Neon](https://neon.tech) account)
- **GitHub OAuth App** (for authentication)

### 1. Clone & Install

```bash
git clone https://github.com/eL1fe/mcpdir.git
cd mcpdir
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Configure your `.env.local`:

```env
# Database (Neon recommended)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# GitHub (for sync + OAuth)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_CLIENT_ID=your-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-oauth-app-client-secret

# NextAuth
AUTH_SECRET=generate-with-openssl-rand-base64-32

# AI Parsing (optional - enhances metadata extraction)
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENROUTER_API_KEY=sk-or-...
```

### 3. Database Setup

```bash
# Generate migrations
pnpm db:generate

# Apply migrations
pnpm db:push

# Seed categories
pnpm seed:categories
```

### 4. Sync Servers

```bash
# Sync from MCP Registry
pnpm sync

# Sync from all sources
pnpm sync:all

# With validation (requires Docker)
pnpm validate:popular
```

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
mcpdir/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Homepage
│   │   ├── servers/            # Server listing & detail pages
│   │   ├── categories/         # Category pages
│   │   ├── auth/               # Authentication pages
│   │   ├── og/                 # Dynamic OG image generation
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── server-card.tsx     # Server display card
│   │   ├── filter-bar.tsx      # Search filters
│   │   └── search-command.tsx  # Command palette
│   ├── lib/
│   │   ├── db/                 # Database schema & queries
│   │   ├── seo/                # SEO utilities
│   │   ├── auth/               # NextAuth configuration
│   │   └── validation/         # MCP validation logic
│   └── types/                  # TypeScript definitions
├── scripts/
│   ├── sync-servers.ts         # Multi-source sync orchestrator
│   ├── validate-servers.ts     # Batch validation runner
│   └── lib/
│       ├── sources/            # Source adapters (npm, GitHub, registry)
│       ├── ai-parser.ts        # AI-powered metadata extraction
│       └── docker-validator.ts # Sandboxed MCP validation
├── drizzle/                    # Database migrations
└── public/                     # Static assets
```

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm sync` | Sync servers from MCP Registry |
| `pnpm sync:all` | Sync from all sources |
| `pnpm sync:force` | Force refresh all servers |
| `pnpm validate` | Run validation on pending servers |
| `pnpm validate:popular` | Validate top servers by stars |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:push` | Push schema changes |

---

## Contributing

We welcome contributions! Here's how to get started:

### Ways to Contribute

- **Add MCP servers** — Submit servers to the registry
- **Improve documentation** — Fix typos, add examples
- **Report bugs** — Open issues with reproduction steps
- **Feature requests** — Suggest new functionality
- **Code contributions** — Pick up open issues

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run linting: `pnpm lint`
5. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

---

## Roadmap

### Completed
- [x] Multi-source indexing (MCP Registry, npm, GitHub, Glama, PulseMCP)
- [x] Server submission form with validation
- [x] Admin dashboard with validation queue
- [x] Auto-revalidation on version updates
- [x] Multi-source server index

### In Progress
- [ ] PyPI source integration

### Planned
- [ ] Server comparison tool
- [ ] Installation analytics
- [ ] API access for programmatic queries
- [ ] Server health monitoring
- [ ] User collections/favorites

### Future Ideas
- [ ] VS Code extension
- [ ] CLI tool for server discovery
- [ ] Self-hosted registry support

---

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io) — The MCP specification
- [MCP Registry](https://github.com/modelcontextprotocol/servers) — Official server list
- [Claude Desktop](https://claude.ai) — MCP-enabled AI assistant

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with [Next.js](https://nextjs.org) and [Neon](https://neon.tech)**

[Report Bug](https://github.com/eL1fe/mcpdir/issues) · [Request Feature](https://github.com/eL1fe/mcpdir/issues) · [Discussions](https://github.com/eL1fe/mcpdir/discussions)

</div>
