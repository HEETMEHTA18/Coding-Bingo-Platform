import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

// PostgreSQL connection
const defaultLocal = "postgresql://user:password@localhost:5432/bingo";
const connectionString = process.env.DATABASE_URL || defaultLocal;

let sql: postgres.Sql;
try {
  sql = postgres(connectionString, {
    max: parseInt(process.env.PG_MAX_POOL || "10"),
    idle_timeout: parseInt(process.env.PG_IDLE_TIMEOUT || "60000"),
    connect_timeout: parseInt(process.env.PG_CONNECTION_TIMEOUT || "10000"),
    prepare: process.env.PG_PREPARE === "true",
  });
} catch (error) {
  console.error('Database connection failed:', error);
  throw error;
}

export const db = drizzle(sql, { schema });
export { sql as rawDb };
