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
      console.log('Connection string hostname:', connectionString.split('@')[1]?.split('/')[0]);
      
      const isNeon = connectionString.includes('neon.tech');
      const config: any = {
        max: parseInt(process.env.PG_MAX_POOL || "20"),
        idle_timeout: parseInt(process.env.PG_IDLE_TIMEOUT || "30000"),
        connect_timeout: parseInt(process.env.PG_CONNECTION_TIMEOUT || "15000"),
        prepare: false, // Disable prepared statements for better compatibility
        // Neon-specific SSL configuration
        ssl: isNeon ? "require" : false,
        // Connection pooling and keep-alive
        keep_alive: 60,
        backoff: (attempt: number) => Math.min(Math.max(100, 40 * Math.pow(2, attempt)), 10000),
        max_lifetime: 300,
        connection: {
          application_name: 'bingo-platform',
        },
      };
      
      console.log('Database config:', {
        isNeon,
        maxPool: config.max,
        connectTimeout: config.connect_timeout,
        ssl: config.ssl,
        prepare: config.prepare
      });
      
      sql = postgres(connectionString, config);
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
