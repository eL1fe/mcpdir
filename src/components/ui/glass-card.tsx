import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.ComponentProps<"div"> {
  variant?: "default" | "elevated" | "subtle";
  glow?: "none" | "cyan" | "purple" | "gradient";
  hover?: boolean;
}

function GlassCard({
  className,
  variant = "default",
  glow = "none",
  hover = true,
  ...props
}: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      className={cn(
        // Base glass styles
        "relative rounded-2xl backdrop-blur-xl",
        "border border-[var(--glass-border)]",
        "transition-all duration-300 ease-out",

        // Variants
        variant === "default" && "bg-[var(--glass)]",
        variant === "elevated" && "bg-[var(--glass-elevated)]",
        variant === "subtle" && "bg-[var(--glass-subtle)]",

        // Glow effects
        glow === "cyan" && "shadow-[var(--glow-cyan)]",
        glow === "purple" && "shadow-[var(--glow-purple)]",
        glow === "gradient" && [
          "before:absolute before:inset-0 before:-z-10 before:rounded-2xl",
          "before:bg-gradient-to-br before:from-cyan/20 before:to-purple/20",
          "before:blur-xl before:opacity-50",
        ],

        // Hover effect
        hover && [
          "hover:-translate-y-1",
          "hover:shadow-lg",
          "hover:border-[var(--border-hover)]",
          glow === "cyan" && "hover:shadow-[var(--glow-cyan-strong)]",
          glow === "purple" && "hover:shadow-[var(--glow-purple-strong)]",
        ],

        className
      )}
      {...props}
    />
  );
}

function GlassCardHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn("p-6 pb-0", className)}
      {...props}
    />
  );
}

function GlassCardTitle({
  className,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="glass-card-title"
      className={cn(
        "text-lg font-semibold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  );
}

function GlassCardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="glass-card-description"
      className={cn("mt-1.5 text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  );
}

function GlassCardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn("p-6", className)}
      {...props}
    />
  );
}

function GlassCardFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn(
        "flex items-center gap-4 p-6 pt-0",
        "border-t border-[var(--glass-border)] mt-auto",
        className
      )}
      {...props}
    />
  );
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
};
