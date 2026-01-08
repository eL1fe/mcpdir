import Link from "next/link";
import {
  Package,
  Database,
  Globe,
  Wrench,
  Brain,
  CheckSquare,
  BarChart,
  MessageCircle,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import { getCategories } from "@/lib/db/queries";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { GradientText } from "@/components/ui/gradient-text";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  databases: Database,
  "file-systems": FolderOpen,
  "apis-services": Globe,
  "dev-tools": Wrench,
  "ai-ml": Brain,
  productivity: CheckSquare,
  "data-analytics": BarChart,
  communication: MessageCircle,
  other: Package,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  databases: { bg: "from-blue-500/20 to-cyan/20", text: "text-blue-400", glow: "group-hover:shadow-blue-500/20" },
  "file-systems": { bg: "from-amber-500/20 to-orange/20", text: "text-amber-400", glow: "group-hover:shadow-amber-500/20" },
  "apis-services": { bg: "from-green/20 to-emerald-500/20", text: "text-green", glow: "group-hover:shadow-green/20" },
  "dev-tools": { bg: "from-purple/20 to-pink-500/20", text: "text-purple", glow: "group-hover:shadow-purple/20" },
  "ai-ml": { bg: "from-cyan/20 to-blue-500/20", text: "text-cyan", glow: "group-hover:shadow-cyan/20" },
  productivity: { bg: "from-rose-500/20 to-pink-500/20", text: "text-rose-400", glow: "group-hover:shadow-rose-500/20" },
  "data-analytics": { bg: "from-violet-500/20 to-purple/20", text: "text-violet-400", glow: "group-hover:shadow-violet-500/20" },
  communication: { bg: "from-teal-500/20 to-cyan/20", text: "text-teal-400", glow: "group-hover:shadow-teal-500/20" },
  other: { bg: "from-gray-500/20 to-slate-500/20", text: "text-gray-400", glow: "group-hover:shadow-gray-500/20" },
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="min-h-screen">
      {/* Header with gradient */}
      <div className="relative overflow-hidden border-b border-[var(--glass-border)]">
        <div className="absolute inset-0 bg-gradient-to-b from-purple/5 via-cyan/3 to-transparent" />
        <div className="container mx-auto px-4 py-12 relative z-10">
          <h1 className="text-4xl font-bold mb-3">
            Browse by <GradientText variant="purple-pink">Category</GradientText>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Explore MCP servers organized by functionality. Find the perfect tools for your AI integration needs.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => {
            const Icon = CATEGORY_ICONS[category.slug] ?? Package;
            const colors = CATEGORY_COLORS[category.slug] ?? CATEGORY_COLORS.other;

            return (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <GlassCard
                  hover
                  className={`h-full transition-all duration-300 ${colors.glow} group-hover:shadow-lg`}
                >
                  <GlassCardContent className="p-6">
                    {/* Icon with gradient background */}
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.bg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon className={`h-7 w-7 ${colors.text}`} />
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-cyan transition-colors">
                      {category.name}
                    </h2>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {category.description}
                    </p>

                    {/* Footer with arrow */}
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--glass-border)]">
                      <span className="text-sm text-muted-foreground">
                        Explore servers
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-cyan group-hover:translate-x-1" />
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
