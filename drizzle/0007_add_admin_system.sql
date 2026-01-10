-- Add admin system tables for multi-admin and activity logging

-- Activity logs table
CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "username" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "device_info" JSONB,
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Admin sessions table
CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
  "session_token" TEXT NOT NULL UNIQUE,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "device_info" JSONB,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "last_active_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "is_active" BOOLEAN DEFAULT TRUE NOT NULL
);

-- Add role and created_by columns to admins table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'role') THEN
    ALTER TABLE "admins" ADD COLUMN "role" TEXT DEFAULT 'admin' NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'created_by') THEN
    ALTER TABLE "admins" ADD COLUMN "created_by" INTEGER REFERENCES "admins"("id");
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'created_at') THEN
    ALTER TABLE "admins" ADD COLUMN "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "activity_logs_timestamp_idx" ON "activity_logs" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "admin_sessions_user_id_idx" ON "admin_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "admin_sessions_token_idx" ON "admin_sessions" ("session_token");
CREATE INDEX IF NOT EXISTS "admin_sessions_active_idx" ON "admin_sessions" ("is_active") WHERE "is_active" = TRUE;
