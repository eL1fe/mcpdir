import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card";
import { GradientText } from "@/components/ui/gradient-text";
import { Github } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan/5 via-transparent to-transparent" />

      <GlassCard className="w-full max-w-md relative z-10" glow="cyan">
        <GlassCardHeader className="text-center">
          <GlassCardTitle className="text-2xl">
            Sign in to <GradientText variant="cyan-purple">MCP Hub</GradientText>
          </GlassCardTitle>
          <p className="text-muted-foreground mt-2">
            Sign in with GitHub to help validate MCP servers
          </p>
        </GlassCardHeader>

        <GlassCardContent>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <Button
              type="submit"
              className="w-full bg-[#24292f] hover:bg-[#24292f]/90 text-white"
              size="lg"
            >
              <Github className="h-5 w-5 mr-2" />
              Continue with GitHub
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By signing in, you agree to help improve the MCP ecosystem.
            Your GitHub profile information will be stored securely.
          </p>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
