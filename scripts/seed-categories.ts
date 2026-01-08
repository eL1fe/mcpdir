import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { categories, tags } from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const CATEGORIES = [
  { slug: "databases", name: "Databases", description: "PostgreSQL, MySQL, SQLite, MongoDB, and other database integrations", icon: "Database", displayOrder: 1 },
  { slug: "file-systems", name: "File Systems", description: "Local files, S3, GCS, Dropbox, and other storage systems", icon: "FolderOpen", displayOrder: 2 },
  { slug: "apis-services", name: "APIs & Services", description: "GitHub, Slack, Notion, Linear, and other service integrations", icon: "Globe", displayOrder: 3 },
  { slug: "dev-tools", name: "Development Tools", description: "Git, Docker, Terminal, and other developer utilities", icon: "Wrench", displayOrder: 4 },
  { slug: "ai-ml", name: "AI & ML", description: "Embeddings, Vector DBs, and machine learning tools", icon: "Brain", displayOrder: 5 },
  { slug: "productivity", name: "Productivity", description: "Calendar, Email, Notes, and productivity apps", icon: "CheckSquare", displayOrder: 6 },
  { slug: "data-analytics", name: "Data & Analytics", description: "BigQuery, Snowflake, and data analysis tools", icon: "BarChart", displayOrder: 7 },
  { slug: "communication", name: "Communication", description: "Discord, Telegram, and messaging platforms", icon: "MessageCircle", displayOrder: 8 },
  { slug: "other", name: "Other", description: "Miscellaneous MCP servers", icon: "Package", displayOrder: 9 },
];

const TAGS = [
  { slug: "official", name: "Official" },
  { slug: "community", name: "Community" },
  { slug: "verified", name: "Verified" },
  { slug: "popular", name: "Popular" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "python", name: "Python" },
  { slug: "go", name: "Go" },
];

async function seed() {
  console.log("Seeding categories...");

  for (const cat of CATEGORIES) {
    await db.insert(categories).values(cat).onConflictDoNothing();
  }

  console.log(`Inserted ${CATEGORIES.length} categories`);

  console.log("Seeding tags...");

  for (const tag of TAGS) {
    await db.insert(tags).values(tag).onConflictDoNothing();
  }

  console.log(`Inserted ${TAGS.length} tags`);

  console.log("Done!");
}

seed().catch(console.error);
