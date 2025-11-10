import postgres from "postgres";
import { config } from "dotenv";

config();

const sql = postgres(process.env.DATABASE_URL);

async function migrate() {
  console.log("🔄 Starting migration...");

  try {
    // Add gameType column to rooms table
    console.log("Adding game_type column to rooms table...");
    await sql`
      ALTER TABLE "rooms" 
      ADD COLUMN IF NOT EXISTS "game_type" text DEFAULT 'bingo' NOT NULL
    `;
    console.log("✅ Added game_type column");

    // Create game_boards table
    console.log("Creating game_boards table...");
    await sql`
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
      )
    `;
    console.log("✅ Created game_boards table");

    // Create game_moves table
    console.log("Creating game_moves table...");
    await sql`
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
      )
    `;
    console.log("✅ Created game_moves table");

    // Create indexes
    console.log("Creating indexes...");
    await sql`CREATE INDEX IF NOT EXISTS "idx_game_boards_room_team" ON "game_boards"("room_code", "team_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_game_boards_game_type" ON "game_boards"("game_type")`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_game_moves_board_id" ON "game_moves"("game_board_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_rooms_game_type" ON "rooms"("game_type")`;
    console.log("✅ Created indexes");

    console.log("\n🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

migrate();
