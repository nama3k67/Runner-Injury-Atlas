CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"injury_slug" text NOT NULL,
	"target" text,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"injury_slug" text NOT NULL,
	"content_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewer_name" text,
	"reviewer_title" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "feedback_injury_status_idx" ON "feedback" USING btree ("injury_slug","status");--> statement-breakpoint
CREATE INDEX "reviews_slug_hash_idx" ON "reviews" USING btree ("injury_slug","content_hash");