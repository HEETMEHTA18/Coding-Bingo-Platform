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
        max: parseInt(process.env.PG_MAX_POOL || "10"), // Reduced from 20 for better serverless compatibility
        idle_timeout: parseInt(process.env.PG_IDLE_TIMEOUT || "20"), // Reduced from 30s
        connect_timeout: parseInt(process.env.PG_CONNECTION_TIMEOUT || "10"), // Reduced from 15s
        prepare: false, // Disable prepared statements for better compatibility
        // Neon-specific SSL configuration
        ssl: isNeon ? "require" : false,
        // Connection pooling and keep-alive
        keep_alive: 60,
        backoff: (attempt: number) => Math.min(Math.max(100, 40 * Math.pow(2, attempt)), 10000),
        max_lifetime: 60 * 10, // 10 minutes max connection lifetime for serverless
        connection: {
          application_name: 'bingo-platform',
        },
        // Add fetch_types for better compatibility
        fetch_types: false,
        // Transform undefined to null
        transform: {
          undefined: null,
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

// Health check function to test database connectivity
export async function checkDbHealth(): Promise<boolean> {
  try {
    const connection = getSqlConnection();
    await connection`SELECT 1 as health_check`;
    console.log('✅ Database health check passed');
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Retry wrapper for database queries
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`Database operation attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        const delay = delayMs * attempt; // Exponential backoff
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Reset connection pool on retry
        sql = null;
        dbInstance = null;
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    return getDbInstance()[prop as keyof ReturnType<typeof drizzle>];
  }
});

export { getSqlConnection as rawDb };
