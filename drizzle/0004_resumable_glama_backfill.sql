CREATE TABLE "sync_checkpoints" (
	"source" varchar(100) PRIMARY KEY NOT NULL,
	"cursor" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"lease_owner" varchar(100),
	"lease_until" timestamp,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"last_run_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "servers_glama_slug_unique" ON "servers" USING btree ("glama_slug");--> statement-breakpoint
CREATE INDEX "servers_github_repo_id_idx" ON "servers" USING btree ("github_repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "servers_source_url_lower_unique" ON "servers" (lower("source_url"));
