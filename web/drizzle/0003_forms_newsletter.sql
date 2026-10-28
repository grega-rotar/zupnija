CREATE TYPE "public"."outbox_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'done', 'declined');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('pending', 'active', 'unsubscribed');--> statement-breakpoint
CREATE TABLE "catechesis_enrolments" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"school_year" text NOT NULL,
	"child_name" text NOT NULL,
	"grade" integer NOT NULL,
	"group_id" integer,
	"data" jsonb NOT NULL,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catechesis_enrolments_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "intention_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"text" text NOT NULL,
	"preferred_date" date,
	"church_slug" text,
	"note" text,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"intention_id" integer,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decline_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" "subscriber_status" DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscribers_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref" text,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"html" text,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"send_after" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sacrament_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"contact" text NOT NULL,
	"preferred_date" date,
	"message" text NOT NULL,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "mailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catechesis_enrolments" ADD CONSTRAINT "catechesis_enrolments_group_id_catechesis_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."catechesis_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intention_requests" ADD CONSTRAINT "intention_requests_intention_id_intentions_id_fk" FOREIGN KEY ("intention_id") REFERENCES "public"."intentions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intention_requests" ADD CONSTRAINT "intention_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacrament_requests" ADD CONSTRAINT "sacrament_requests_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intention_requests_status" ON "intention_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbox_due" ON "outbox" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "rate_limit_hits_key" ON "rate_limit_hits" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "sacrament_requests_status" ON "sacrament_requests" USING btree ("status");