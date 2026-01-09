import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getCategories } from "@/lib/db/queries";
import { SubmitForm } from "@/components/submissions";
import { GradientText } from "@/components/ui/gradient-text";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Submit an MCP Server — MCP Hub",
  description:
    "Submit your MCP server to the directory. Share your integration with the community and help others discover it.",
  alternates: {
    canonical: `${SITE_URL}/submit`,
  },
};

export default async function SubmitPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/submit");
  }

  const categories = await getCategories();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-[var(--glass-border)]">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan/5 via-purple/3 to-transparent" />
        <div className="container mx-auto px-4 py-12 relative z-10">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-3">
            Submit Your <GradientText variant="cyan-purple">MCP Server</GradientText>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Share your MCP integration with the community. Our team will review your submission
            and add it to the directory.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <SubmitForm categories={categories} />
      </div>
    </div>
  );
}
