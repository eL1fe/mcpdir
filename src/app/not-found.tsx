import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { GradientText } from "@/components/ui/gradient-text";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple/10 rounded-full blur-3xl" />
      </div>

      <GlassCard className="max-w-md w-full text-center relative z-10">
        <GlassCardContent className="py-12 px-8">
          <div className="text-8xl font-bold mb-4">
            <GradientText variant="cyan-purple">404</GradientText>
          </div>

          <h1 className="text-2xl font-semibold mb-2">Page Not Found</h1>

          <p className="text-muted-foreground mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="default" className="bg-gradient-to-r from-cyan to-purple hover:opacity-90">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Link>
            </Button>

            <Button asChild variant="outline" className="border-[var(--glass-border)]">
              <Link href="/servers">
                <Search className="h-4 w-4 mr-2" />
                Browse Servers
              </Link>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--glass-border)]">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="javascript:history.back()">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go back
              </Link>
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
