-- Website content in Postgres (tasks/contract-content.md): the content and media tables, and the
-- editor areas "vsebina" (Vsebina strani) and "zupnija" (Župnija) as sections. Made with drizzle-kit generate.
ALTER TYPE "public"."section" ADD VALUE 'vsebina';--> statement-breakpoint
ALTER TYPE "public"."section" ADD VALUE 'zupnija';--> statement-breakpoint
CREATE TABLE "content" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"slug" text,
	"data" jsonb NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"lqip" text,
	"filename" text,
	"sha256" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "content_type_sort" ON "content" USING btree ("type","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "content_type_slug" ON "content" USING btree ("type","slug") WHERE "content"."slug" is not null;