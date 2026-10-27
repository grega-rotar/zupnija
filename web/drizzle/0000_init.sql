CREATE TYPE "public"."bulletin_status" AS ENUM('reading', 'draft', 'unreadable', 'ai_busy', 'pending', 'published');--> statement-breakpoint
CREATE TYPE "public"."change_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."intention_kind" AS ENUM('deceased', 'thanksgiving', 'other');--> statement-breakpoint
CREATE TYPE "public"."mass_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."mass_type" AS ENUM('regular', 'sunday', 'family', 'children', 'youth', 'evening');--> statement-breakpoint
CREATE TYPE "public"."section" AS ENUM('mase', 'oznanila', 'dogodki', 'verouk');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulletin_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"bulletin_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulletins" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"status" "bulletin_status" NOT NULL,
	"upload_id" integer,
	"draft" jsonb,
	"error" text,
	"published_at" timestamp with time zone,
	"published_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bulletins_week_start_unique" UNIQUE("week_start")
);
--> statement-breakpoint
CREATE TABLE "catechesis_cancellations" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"date" date NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catechesis_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"weekday" integer NOT NULL,
	"time" time NOT NULL,
	"place" text NOT NULL,
	"kids" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"section" "section" NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb NOT NULL,
	"label" text NOT NULL,
	"status" "change_status" DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "churches" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "churches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"place" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"on_front_page" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"section" text NOT NULL,
	"action" text NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"changes" jsonb NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"mass_id" integer NOT NULL,
	"kind" "intention_kind" DEFAULT 'deceased' NOT NULL,
	"text" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"moved_from_mass_id" integer,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mass_day_overrides" (
	"date" date PRIMARY KEY NOT NULL,
	"replaces_schedule" boolean DEFAULT true NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "mass_schedule_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"weekdays" integer[] NOT NULL,
	"time" time NOT NULL,
	"church_id" integer NOT NULL,
	"type" "mass_type" DEFAULT 'regular' NOT NULL,
	"note" text,
	"valid_from" date,
	"valid_until" date
);
--> statement-breakpoint
CREATE TABLE "masses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"church_id" integer NOT NULL,
	"type" "mass_type" DEFAULT 'regular' NOT NULL,
	"status" "mass_status" DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	"note" text,
	"source" text DEFAULT 'schedule' NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"path" text NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text DEFAULT 'Sodelavec' NOT NULL,
	"short" text DEFAULT '' NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"big_text" boolean DEFAULT false NOT NULL,
	"invited_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_sections" (
	"user_id" text NOT NULL,
	"section" "section" NOT NULL,
	CONSTRAINT "user_sections_user_id_section_pk" PRIMARY KEY("user_id","section")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletin_notices" ADD CONSTRAINT "bulletin_notices_bulletin_id_bulletins_id_fk" FOREIGN KEY ("bulletin_id") REFERENCES "public"."bulletins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins" ADD CONSTRAINT "bulletins_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins" ADD CONSTRAINT "bulletins_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catechesis_cancellations" ADD CONSTRAINT "catechesis_cancellations_group_id_catechesis_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."catechesis_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intentions" ADD CONSTRAINT "intentions_mass_id_masses_id_fk" FOREIGN KEY ("mass_id") REFERENCES "public"."masses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intentions" ADD CONSTRAINT "intentions_moved_from_mass_id_masses_id_fk" FOREIGN KEY ("moved_from_mass_id") REFERENCES "public"."masses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intentions" ADD CONSTRAINT "intentions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mass_schedule_entries" ADD CONSTRAINT "mass_schedule_entries_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masses" ADD CONSTRAINT "masses_church_id_churches_id_fk" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sections" ADD CONSTRAINT "user_sections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catechesis_cancellation_group_date" ON "catechesis_cancellations" USING btree ("group_id","date");--> statement-breakpoint
CREATE INDEX "change_requests_status" ON "change_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_date" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "history_created" ON "history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "intentions_mass" ON "intentions" USING btree ("mass_id");--> statement-breakpoint
CREATE UNIQUE INDEX "masses_date_time_church" ON "masses" USING btree ("date","time","church_id");--> statement-breakpoint
CREATE INDEX "masses_date" ON "masses" USING btree ("date");