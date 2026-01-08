import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { servers } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const server = await db.query.servers.findFirst({
    where: eq(servers.slug, "mcp-server-browser")
  });
  
  if (server) {
    console.log(JSON.stringify({
      name: server.name,
      slug: server.slug,
      description: server.description,
      githubUrl: server.githubUrl,
      npmUrl: server.npmUrl,
      installCommand: server.installCommand,
      validationStatus: server.validationStatus,
      validationError: server.validationError,
      tools: server.tools,
      starsCount: server.starsCount,
    }, null, 2));
  } else {
    console.log("Not found");
  }
  process.exit(0);
}
main();
