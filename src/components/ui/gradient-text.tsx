import * as React from "react";
import { cn } from "@/lib/utils";

type GradientVariant =
  | "cyan-purple"
  | "purple-pink"
  | "cyan-green"
  | "sunset"
  | "ocean"
  | "aurora";

interface GradientTextProps {
  variant?: GradientVariant;
  animate?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const gradients: Record<GradientVariant, string> = {
  "cyan-purple": "from-cyan via-purple to-cyan",
  "purple-pink": "from-purple via-pink-500 to-purple",
  "cyan-green": "from-cyan via-green to-cyan",
  "sunset": "from-orange-400 via-pink-500 to-purple",
  "ocean": "from-cyan via-blue-500 to-purple",
  "aurora": "from-green via-cyan to-purple",
};

function GradientText({
  className,
  variant = "cyan-purple",
  animate = false,
  children,
}: GradientTextProps) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r bg-clip-text text-transparent",
        gradients[variant],
        animate && "bg-[length:200%_auto] animate-gradient-shift",
        className
      )}
    >
      {children}
    </span>
  );
}

interface GradientHeadingProps extends GradientTextProps {
  level?: 1 | 2 | 3 | 4;
}

function GradientHeading({
  level = 1,
  className,
  variant = "cyan-purple",
  animate = false,
  children,
}: GradientHeadingProps) {
  const sizeClasses = {
    1: "text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight",
    2: "text-3xl sm:text-4xl font-bold tracking-tight",
    3: "text-2xl sm:text-3xl font-semibold tracking-tight",
    4: "text-xl sm:text-2xl font-semibold",
  };

  const headingClassName = cn(
    "bg-gradient-to-r bg-clip-text text-transparent",
    gradients[variant],
    animate && "bg-[length:200%_auto] animate-gradient-shift",
    sizeClasses[level],
    className
  );

  switch (level) {
    case 1:
      return <h1 className={headingClassName}>{children}</h1>;
    case 2:
      return <h2 className={headingClassName}>{children}</h2>;
    case 3:
      return <h3 className={headingClassName}>{children}</h3>;
    case 4:
      return <h4 className={headingClassName}>{children}</h4>;
    default:
      return <h1 className={headingClassName}>{children}</h1>;
  }
}

export { GradientText, GradientHeading };
export type { GradientVariant };
