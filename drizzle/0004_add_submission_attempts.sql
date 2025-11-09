-- Create submission_attempts table to track all submission attempts (correct and incorrect)
CREATE TABLE IF NOT EXISTS "submission_attempts" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "team_id" text NOT NULL REFERENCES "teams"("team_id"),
  "question_id" integer NOT NULL REFERENCES "questions"("question_id"),
  "room_code" text NOT NULL REFERENCES "rooms"("code"),
  "submitted_answer" text NOT NULL,
  "is_correct" boolean NOT NULL,
  "position" text,
  "attempted_at" timestamp DEFAULT now() NOT NULL,
  "is_deleted" boolean DEFAULT false NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "idx_submission_attempts_room" ON "submission_attempts"("room_code", "attempted_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_submission_attempts_team" ON "submission_attempts"("team_id", "attempted_at" DESC);
