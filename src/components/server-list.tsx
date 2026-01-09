import { ServerCard } from "./server-card";
import type { ServerWithRelations } from "@/types";

interface ServerListProps {
  servers: ServerWithRelations[];
}

export function ServerList({ servers }: ServerListProps) {
  if (servers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No servers found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {servers.map((server, index) => (
        <div
          key={server.id}
          className="animate-[fade-in-up_0.5s_ease_forwards] opacity-0"
          style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
        >
          <ServerCard server={server} />
        </div>
      ))}
    </div>
  );
}
