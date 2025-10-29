CREATE TABLE "questions" (
	"question_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "questions_question_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"room_code" text NOT NULL,
	"question_text" text NOT NULL,
	"is_real" boolean NOT NULL,
	"correct_answer" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"round_end_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_question_mapping" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_question_mapping_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"grid_position" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_solved_positions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_solved_positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" text NOT NULL,
	"position" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_solved_questions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "team_solved_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"solved_at" timestamp NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"team_id" text PRIMARY KEY NOT NULL,
	"team_name" text NOT NULL,
	"room_code" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"lines_completed" integer DEFAULT 0 NOT NULL,
	"end_time" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wipe_audits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wipe_audits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"initiated_by" text,
	"initiated_at" timestamp NOT NULL,
	"options" text,
	"deleted_counts" text
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_question_mapping" ADD CONSTRAINT "team_question_mapping_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_question_mapping" ADD CONSTRAINT "team_question_mapping_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_solved_positions" ADD CONSTRAINT "team_solved_positions_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_solved_questions" ADD CONSTRAINT "team_solved_questions_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_solved_questions" ADD CONSTRAINT "team_solved_questions_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE no action ON UPDATE no action;