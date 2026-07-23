CREATE TABLE "quest_claims" (
	"user_id" uuid NOT NULL,
	"quest_id" text NOT NULL,
	"week" date NOT NULL,
	"reward" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now(),
	CONSTRAINT "quest_claims_user_id_quest_id_week_unique" UNIQUE("user_id","quest_id","week")
);
--> statement-breakpoint
ALTER TABLE "quest_claims" ADD CONSTRAINT "quest_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;