import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

// PostgreSQL connection - lazy initialization for serverless
const defaultLocal = "postgresql://user:password@localhost:5432/bingo";

let sql: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getSqlConnection() {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL || defaultLocal;
    try {
      console.log('Attempting database connection...');
      sql = postgres(connectionString, {
        max: parseInt(process.env.PG_MAX_POOL || "10"),
        idle_timeout: parseInt(process.env.PG_IDLE_TIMEOUT || "60000"),
        connect_timeout: parseInt(process.env.PG_CONNECTION_TIMEOUT || "10000"),
        prepare: process.env.PG_PREPARE === "true",
        // Add retry logic for connection issues
        retry: {
          max: 3,
          timeout: 5000,
        },
        // Handle SSL issues - Neon requires SSL
        ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
        // Additional Neon-specific options
        keep_alive: 30,
        connection: {
          application_name: 'bingo-platform',
        },
      });
      console.log('Database connection established successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      // In development, provide a more helpful error message
      if (process.env.NODE_ENV !== 'production') {
        console.error('💡 Development tip: Check your DATABASE_URL in .env file');
        console.error('💡 For local development, you can use: DATABASE_URL="postgresql://user:password@localhost:5432/bingo"');
        console.error('💡 Make sure PostgreSQL is running locally or update the connection string');
      }
      throw error;
    }
  }
  return sql;
}

function getDbInstance() {
  if (!dbInstance) {
    dbInstance = drizzle(getSqlConnection(), { schema });
  }
  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    return getDbInstance()[prop as keyof ReturnType<typeof drizzle>];
  }
});

export { getSqlConnection as rawDb };
