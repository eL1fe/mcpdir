import { Wrench } from "lucide-react";

interface Tool {
  name: string;
  description?: string;
}

interface ToolsListProps {
  tools: Tool[];
  maxShow?: number;
}

export function ToolsList({ tools, maxShow = 5 }: ToolsListProps) {
  const displayTools = tools.slice(0, maxShow);
  const remaining = tools.length - maxShow;

  return (
    <div className="space-y-2">
      {displayTools.map((tool) => (
        <div key={tool.name} className="flex items-start gap-2 text-sm">
          <Wrench className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{tool.name}</code>
            {tool.description && (
              <p className="text-muted-foreground text-xs mt-0.5">{tool.description}</p>
            )}
          </div>
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground ml-6">
          +{remaining} more tool{remaining > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
