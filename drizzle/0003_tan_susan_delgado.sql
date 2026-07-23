CREATE TABLE "league_standings" (
	"user_id" uuid NOT NULL,
	"week" date NOT NULL,
	"tier" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "league_standings_user_id_week_unique" UNIQUE("user_id","week")
);
--> statement-breakpoint
ALTER TABLE "league_standings" ADD CONSTRAINT "league_standings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;