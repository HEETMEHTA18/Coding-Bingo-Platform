CREATE TABLE "questions" (
	"question_id" serial PRIMARY KEY NOT NULL,
	"room_code" varchar(10) NOT NULL,
	"question_text" text NOT NULL,
	"is_real" boolean NOT NULL,
	"correct_answer" text NOT NULL,
	"assigned_grid_pos" varchar(5)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"round_end_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_solved_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" varchar(50) NOT NULL,
	"position" varchar(5) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_solved_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" varchar(50) NOT NULL,
	"question_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"team_id" varchar(50) PRIMARY KEY NOT NULL,
	"team_name" text NOT NULL,
	"room_code" varchar(10) NOT NULL,
	"start_time" timestamp NOT NULL,
	"lines_completed" integer DEFAULT 0 NOT NULL,
	"end_time" timestamp
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_solved_positions" ADD CONSTRAINT "team_solved_positions_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_solved_questions" ADD CONSTRAINT "team_solved_questions_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_solved_questions" ADD CONSTRAINT "team_solved_questions_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE no action ON UPDATE no action;