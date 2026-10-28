-- Monthly bulletins (tasks/contract-oznanila-monthly.md). Hand-edited after drizzle-kit
-- generate: the new bulletins columns are added nullable, filled from week_start for the
-- existing weekly rows (production has one: week 2026-10-25, published), then made NOT NULL.
CREATE TABLE "calendar_days" (
	"date" date PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"sunday_name" text,
	"gospel" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"bulletin_id" integer
);
--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "period_start" date;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "period_end" date;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "issue" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "article" jsonb;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "prayer_intention" jsonb;--> statement-breakpoint
UPDATE "bulletins" SET
	"period_start" = "week_start",
	"period_end" = "week_start" + 6,
	"title" = 'Teden ' || to_char("week_start", 'FMDD. FMMM.') || '–' || to_char("week_start" + 6, 'FMDD. FMMM. YYYY');--> statement-breakpoint
ALTER TABLE "bulletins" ALTER COLUMN "period_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ALTER COLUMN "period_end" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" DROP CONSTRAINT "bulletins_week_start_unique";--> statement-breakpoint
ALTER TABLE "bulletins" DROP COLUMN "week_start";--> statement-breakpoint
ALTER TABLE "bulletins" ADD CONSTRAINT "bulletins_period_start_unique" UNIQUE("period_start");--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "source_bulletin_id" integer;--> statement-breakpoint
ALTER TABLE "calendar_days" ADD CONSTRAINT "calendar_days_bulletin_id_bulletins_id_fk" FOREIGN KEY ("bulletin_id") REFERENCES "public"."bulletins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_bulletin_id_bulletins_id_fk" FOREIGN KEY ("source_bulletin_id") REFERENCES "public"."bulletins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
