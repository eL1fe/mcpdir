import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface CategoryBadgeProps {
  slug: string;
  name: string;
  linked?: boolean;
}

export function CategoryBadge({ slug, name, linked = true }: CategoryBadgeProps) {
  const badge = (
    <Badge variant="secondary" className="font-normal">
      {name}
    </Badge>
  );

  if (linked) {
    return (
      <Link href={`/categories/${slug}`} className="hover:opacity-80 transition-opacity">
        {badge}
      </Link>
    );
  }

  return badge;
}
