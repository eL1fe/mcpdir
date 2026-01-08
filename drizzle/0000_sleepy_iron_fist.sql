CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"display_order" integer DEFAULT 0,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "server_categories" (
	"server_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "server_categories_server_id_category_id_pk" PRIMARY KEY("server_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "server_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_identifier" varchar(500),
	"source_url" varchar(500),
	"source_data" jsonb,
	"content_hash" varchar(64),
	"first_seen_at" timestamp DEFAULT now(),
	"last_seen_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "server_tags" (
	"server_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "server_tags_server_id_tag_id_pk" PRIMARY KEY("server_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"source_type" varchar(50) NOT NULL,
	"source_url" varchar(500) NOT NULL,
	"homepage_url" varchar(500),
	"package_name" varchar(255),
	"package_registry" varchar(50),
	"latest_version" varchar(50),
	"readme_content" text,
	"install_command" varchar(500),
	"tools" jsonb DEFAULT '[]'::jsonb,
	"resources" jsonb DEFAULT '[]'::jsonb,
	"prompts" jsonb DEFAULT '[]'::jsonb,
	"capabilities" jsonb DEFAULT '{}'::jsonb,
	"stars_count" integer DEFAULT 0,
	"forks_count" integer DEFAULT 0,
	"last_commit_at" timestamp,
	"status" varchar(50) DEFAULT 'active',
	"content_hash" varchar(64),
	"last_synced_at" timestamp,
	"registry_data" jsonb,
	"validated_at" timestamp,
	"validation_status" varchar(50),
	"validation_result" jsonb,
	"validation_error" text,
	"validation_duration_ms" integer,
	"github_repo_id" bigint,
	"npm_downloads" integer,
	"npm_quality_score" numeric(3, 2),
	"discovered_sources" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "servers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "server_categories" ADD CONSTRAINT "server_categories_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_categories" ADD CONSTRAINT "server_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_sources" ADD CONSTRAINT "server_sources_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_tags" ADD CONSTRAINT "server_tags_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_tags" ADD CONSTRAINT "server_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "server_source_unique" ON "server_sources" USING btree ("server_id","source");