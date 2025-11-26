import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

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
        idle_timeout: parseInt(process.env.PG_IDLE_TIMEOUT || "30"), // Increased for stability
        connect_timeout: parseInt(process.env.PG_CONNECTION_TIMEOUT || "30"), // Increased to 30s
        prepare: false, // Disable prepared statements for better compatibility
        // Neon-specific SSL configuration
        ssl: isNeon ? "require" : false,
        // Connection pooling and keep-alive
        keep_alive: 60,
        backoff: (attempt: number) => Math.min(Math.max(100, 40 * Math.pow(2, attempt)), 10000),
        max_lifetime: 60 * 15, // 15 minutes max connection lifetime
        connection: {
          application_name: 'bingo-platform',
        },
        // Add fetch_types for better compatibility
        fetch_types: false,
        // Transform undefined to null
        transform: {
          undefined: null,
        },
        // Add retry logic
        onnotice: () => { }, // Suppress notices
        debug: false, // Disable debug for production
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

      // Test the connection immediately
      sql`SELECT 1 as test`.then(() => {
        console.log('✅ Database connection verified');
      }).catch(err => {
        console.error('⚠️ Database connection test failed:', err.message);
        if (err.code === 'ENOTFOUND') {
          console.error('❌ DNS resolution failed - check your internet connection or database hostname');
        }
      });
    } catch (error: any) {
      console.error('Database connection failed:', error);

      // Provide specific guidance based on error type
      if (error.code === 'ENOTFOUND') {
        console.error('❌ Cannot resolve database hostname - check:');
        console.error('   1. Internet connection');
        console.error('   2. DATABASE_URL in .env file');
        console.error('   3. Database service is accessible');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        console.error('❌ Connection timeout or refused - database may be down');
      }

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

// Graceful shutdown - cleanup connections
export async function closeDbConnections() {
  if (sql) {
    try {
      await sql.end({ timeout: 5 });
      console.log('Database connections closed gracefully');
      sql = null;
      dbInstance = null;
    } catch (err) {
      console.error('Error closing database connections:', err);
    }
  }
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
