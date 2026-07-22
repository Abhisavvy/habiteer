CREATE TABLE "freeze_tokens" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "completions" ADD COLUMN "freeze_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "completions" ADD COLUMN "freeze_granted" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "freeze_tokens" ADD CONSTRAINT "freeze_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;