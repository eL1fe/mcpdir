import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  bigint,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Servers table
export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Source
  sourceType: varchar("source_type", { length: 50 }).notNull(), // github | npm | pypi | manual | glama
  sourceUrl: varchar("source_url", { length: 500 }).notNull().unique(),
  homepageUrl: varchar("homepage_url", { length: 500 }),

  // Package info
  packageName: varchar("package_name", { length: 255 }),
  packageRegistry: varchar("package_registry", { length: 50 }), // npm | pypi | null
  latestVersion: varchar("latest_version", { length: 50 }),

  // Content
  readmeContent: text("readme_content"),
  installCommand: varchar("install_command", { length: 500 }),

  // MCP specific (JSONB)
  tools: jsonb("tools").$type<{ name: string; description?: string }[]>().default([]),
  resources: jsonb("resources").$type<{ uri: string; name?: string; description?: string }[]>().default([]),
  prompts: jsonb("prompts").$type<{ name: string; description?: string }[]>().default([]),
  capabilities: jsonb("capabilities").$type<Record<string, boolean>>().default({}),
  envConfigSchema: jsonb("env_config_schema").$type<Record<string, unknown> | null>(), // JSON Schema for required environment variables (from Glama)

  // GitHub metrics
  starsCount: integer("stars_count").default(0),
  forksCount: integer("forks_count").default(0),
  lastCommitAt: timestamp("last_commit_at"),

  // Status
  status: varchar("status", { length: 50 }).default("active"), // pending | active | verified | deprecated

  // Sync tracking
  contentHash: varchar("content_hash", { length: 64 }), // SHA-256 of registry data for change detection
  lastSyncedAt: timestamp("last_synced_at"),
  registryData: jsonb("registry_data"), // Raw registry response for debugging

  // Validation
  validatedAt: timestamp("validated_at"),
  validationStatus: varchar("validation_status", { length: 50 }), // pending | validated | failed | skipped | needs_config
  validationResult: jsonb("validation_result"), // actual discovered capabilities from MCP handshake
  validationError: text("validation_error"),
  validationDurationMs: integer("validation_duration_ms"),

  // Multi-source tracking
  githubRepoId: bigint("github_repo_id", { mode: "number" }), // Canonical GitHub ID for deduplication
  npmDownloads: integer("npm_downloads"), // Weekly downloads from npm
  npmQualityScore: numeric("npm_quality_score", { precision: 3, scale: 2 }), // npm quality score 0-1
  discoveredSources: jsonb("discovered_sources").$type<string[]>().default([]), // ['mcp-registry', 'npm', 'github']

  // Glama enrichment data
  glamaSlug: varchar("glama_slug", { length: 255 }), // e.g. "@stripe/agent-toolkit" for linking
  glamaQualityScore: integer("glama_quality_score"), // 0-130+
  glamaSecurityScore: integer("glama_security_score"), // 0-130+
  glamaLicenseScore: integer("glama_license_score"), // 0-100
  supportedPlatforms: jsonb("supported_platforms").$type<string[]>(), // ['MACOS', 'WINDOWS', 'LINUX']
  glamaEnrichedAt: timestamp("glama_enriched_at"),

  // User features
  claimedBy: uuid("claimed_by"),
  claimedAt: timestamp("claimed_at"),
  averageRating: numeric("average_rating", { precision: 2, scale: 1 }),
  reviewsCount: integer("reviews_count").default(0),

  // Meta
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories table
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // Lucide icon name
  displayOrder: integer("display_order").default(0),
});

// Tags table
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
});

// Junction: server_categories
export const serverCategories = pgTable(
  "server_categories",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.categoryId] })]
);

// Junction: server_tags
export const serverTags = pgTable(
  "server_tags",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serverId, t.tagId] })]
);

// Server sources tracking (multi-source provenance)
export const serverSources = pgTable(
  "server_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 50 }).notNull(), // 'mcp-registry' | 'npm' | 'github' | 'pypi'
    sourceIdentifier: varchar("source_identifier", { length: 500 }), // package name or repo id
    sourceUrl: varchar("source_url", { length: 500 }), // URL to the source listing
    sourceData: jsonb("source_data"), // Raw API response
    contentHash: varchar("content_hash", { length: 64 }), // Per-source hash for incremental sync
    firstSeenAt: timestamp("first_seen_at").defaultNow(),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
  },
  (t) => [uniqueIndex("server_source_unique").on(t.serverId, t.source)]
);

// Relations
export const serversRelations = relations(servers, ({ many, one }) => ({
  serverCategories: many(serverCategories),
  serverTags: many(serverTags),
  serverSources: many(serverSources),
  reviews: many(reviews),
  reports: many(reports),
  claims: many(serverClaims),
  claimedByUser: one(users, {
    fields: [servers.claimedBy],
    references: [users.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  serverCategories: many(serverCategories),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  serverTags: many(serverTags),
}));

export const serverCategoriesRelations = relations(serverCategories, ({ one }) => ({
  server: one(servers, {
    fields: [serverCategories.serverId],
    references: [servers.id],
  }),
  category: one(categories, {
    fields: [serverCategories.categoryId],
    references: [categories.id],
  }),
}));

export const serverTagsRelations = relations(serverTags, ({ one }) => ({
  server: one(servers, {
    fields: [serverTags.serverId],
    references: [servers.id],
  }),
  tag: one(tags, {
    fields: [serverTags.tagId],
    references: [tags.id],
  }),
}));

export const serverSourcesRelations = relations(serverSources, ({ one }) => ({
  server: one(servers, {
    fields: [serverSources.serverId],
    references: [servers.id],
  }),
}));

// Search analytics
export const searchQueries = pgTable("search_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  query: varchar("query", { length: 500 }).notNull(),
  resultsCount: integer("results_count").notNull(),
  category: varchar("category", { length: 100 }),
  tags: varchar("tags", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users table (for auth)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique().notNull(),
  githubUsername: varchar("github_username", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  isAdmin: integer("is_admin").default(0), // 0 = false, 1 = true (postgres boolean workaround)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Manual validation submissions
export const manualValidations = pgTable("manual_validations", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  installCommand: varchar("install_command", { length: 500 }),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | validating | completed | failed | cancelled
  isOwnerSubmission: integer("is_owner_submission").default(0), // 0 = false, 1 = true
  validationResult: jsonb("validation_result"),
  validationError: text("validation_error"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // GitHub Actions async validation
  encryptedCredentials: text("encrypted_credentials"), // Temporary, deleted after validation
  workflowRunId: varchar("workflow_run_id", { length: 100 }), // GitHub Actions run ID
  // Retry tracking
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
});

// Validation audit log
export const validationAuditLog = pgTable("validation_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").references(() => servers.id),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(), // submit | approve | reject | validate | retry
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Server submissions (user-submitted servers for review)
export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // GitHub repo info
  githubUrl: varchar("github_url", { length: 500 }).notNull(),
  repoOwner: varchar("repo_owner", { length: 100 }).notNull(),
  repoName: varchar("repo_name", { length: 100 }).notNull(),

  // Metadata (auto-fetched from GitHub)
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  starsCount: integer("stars_count"),

  // User input
  categoryIds: jsonb("category_ids").$type<string[]>().default([]),

  // Review
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | approved | rejected
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),

  // Result (after approval)
  serverId: uuid("server_id").references(() => servers.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reviews & ratings
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1-5
    content: text("content"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [uniqueIndex("review_user_server_unique").on(t.serverId, t.userId)]
);

// Issue reports
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // broken | spam | outdated | security | other
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | resolved | dismissed
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Server ownership claims
export const serverClaims = pgTable(
  "server_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verificationMethod: varchar("verification_method", { length: 50 }).notNull(), // file | github_owner
    verificationToken: varchar("verification_token", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(), // pending | verified | rejected | expired
    verifiedAt: timestamp("verified_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("claim_server_user_unique").on(t.serverId, t.userId)]
);

// Relations for users
export const usersRelations = relations(users, ({ many }) => ({
  manualValidations: many(manualValidations),
  reviewedValidations: many(manualValidations, { relationName: "reviewer" }),
  auditLogs: many(validationAuditLog),
  submissions: many(submissions),
  reviewedSubmissions: many(submissions, { relationName: "submissionReviewer" }),
  reviews: many(reviews),
  reports: many(reports),
  resolvedReports: many(reports, { relationName: "reportResolver" }),
  serverClaims: many(serverClaims),
  claimedServers: many(servers),
}));

export const manualValidationsRelations = relations(manualValidations, ({ one }) => ({
  server: one(servers, {
    fields: [manualValidations.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [manualValidations.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [manualValidations.reviewedBy],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

export const validationAuditLogRelations = relations(validationAuditLog, ({ one }) => ({
  server: one(servers, {
    fields: [validationAuditLog.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [validationAuditLog.userId],
    references: [users.id],
  }),
}));

// Types
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type ServerSource = typeof serverSources.$inferSelect;
export type NewServerSource = typeof serverSources.$inferInsert;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type NewSearchQuery = typeof searchQueries.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ManualValidation = typeof manualValidations.$inferSelect;
export type NewManualValidation = typeof manualValidations.$inferInsert;
export type ValidationAuditLog = typeof validationAuditLog.$inferSelect;
export type NewValidationAuditLog = typeof validationAuditLog.$inferInsert;
