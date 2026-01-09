import Image from "next/image";
import { Calendar, Star, Upload, Server } from "lucide-react";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { GradientText } from "@/components/ui/gradient-text";

interface ProfileHeaderProps {
  user: {
    githubUsername: string;
    avatarUrl: string | null;
    createdAt: Date | null;
    stats: {
      reviews: number;
      submissions: number;
      claimedServers: number;
    };
  };
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  const joinDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <GlassCard>
      <GlassCardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan to-purple rounded-full blur-md opacity-50" />
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.githubUsername}
                width={96}
                height={96}
                className="relative rounded-full border-2 border-[var(--glass-border)]"
              />
            ) : (
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-cyan/20 to-purple/20 border-2 border-[var(--glass-border)] flex items-center justify-center">
                <span className="text-3xl font-bold text-cyan">
                  {user.githubUsername.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold">
              <GradientText variant="cyan-purple">
                {user.githubUsername}
              </GradientText>
            </h1>
            <p className="text-muted-foreground">@{user.githubUsername}</p>

            {joinDate && (
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Joined {joinDate}</span>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
              <div className="text-center">
                <div className="flex items-center gap-1.5 text-lg font-semibold">
                  <Star className="h-4 w-4 text-amber-400" />
                  {user.stats.reviews}
                </div>
                <div className="text-xs text-muted-foreground">Reviews</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1.5 text-lg font-semibold">
                  <Upload className="h-4 w-4 text-cyan" />
                  {user.stats.submissions}
                </div>
                <div className="text-xs text-muted-foreground">Submitted</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1.5 text-lg font-semibold">
                  <Server className="h-4 w-4 text-purple" />
                  {user.stats.claimedServers}
                </div>
                <div className="text-xs text-muted-foreground">Claimed</div>
              </div>
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
