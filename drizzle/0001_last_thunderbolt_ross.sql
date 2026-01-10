CREATE TABLE "game_boards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_boards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"room_code" text NOT NULL,
	"team_id" text NOT NULL,
	"game_type" text NOT NULL,
	"board_state" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_moves" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_moves_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_board_id" integer NOT NULL,
	"team_id" text NOT NULL,
	"move_data" text NOT NULL,
	"move_number" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "submission_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"team_id" text NOT NULL,
	"question_id" integer NOT NULL,
	"room_code" text NOT NULL,
	"submitted_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"position" text,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "game_type" text DEFAULT 'bingo' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_boards" ADD CONSTRAINT "game_boards_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_boards" ADD CONSTRAINT "game_boards_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_board_id_game_boards_id_fk" FOREIGN KEY ("game_board_id") REFERENCES "public"."game_boards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_question_id_questions_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("question_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_room_code_rooms_code_fk" FOREIGN KEY ("room_code") REFERENCES "public"."rooms"("code") ON DELETE no action ON UPDATE no action;