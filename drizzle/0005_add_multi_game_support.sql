-- Add gameType to rooms table
ALTER TABLE "rooms" ADD COLUMN "game_type" text DEFAULT 'bingo' NOT NULL;

-- Create game_boards table for storing game states
CREATE TABLE IF NOT EXISTS "game_boards" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "room_code" text NOT NULL,
  "team_id" text NOT NULL,
  "game_type" text NOT NULL,
  "board_state" text NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "is_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  CONSTRAINT "game_boards_room_code_fkey" FOREIGN KEY ("room_code") REFERENCES "rooms"("code"),
  CONSTRAINT "game_boards_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("team_id")
);

-- Create game_moves table for turn-based games
CREATE TABLE IF NOT EXISTS "game_moves" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "game_board_id" integer NOT NULL,
  "team_id" text NOT NULL,
  "move_data" text NOT NULL,
  "move_number" integer NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL,
  CONSTRAINT "game_moves_game_board_id_fkey" FOREIGN KEY ("game_board_id") REFERENCES "game_boards"("id"),
  CONSTRAINT "game_moves_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("team_id")
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_game_boards_room_team" ON "game_boards"("room_code", "team_id");
CREATE INDEX IF NOT EXISTS "idx_game_boards_game_type" ON "game_boards"("game_type");
CREATE INDEX IF NOT EXISTS "idx_game_moves_board_id" ON "game_moves"("game_board_id");
CREATE INDEX IF NOT EXISTS "idx_rooms_game_type" ON "rooms"("game_type");
