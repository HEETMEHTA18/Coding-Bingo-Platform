import "dotenv/config";
import { createServer } from "../server/index.js";
import { checkDbHealth, closeDbConnections } from "../server/db.js";

const app = createServer();
const PORT = process.env.PORT || 5000;

// Warm up database connection before starting server
async function startServer() {
  console.log('🔄 Warming up database connection...');
  
  try {
    // Check database health with timeout
    const healthCheck = await Promise.race([
      checkDbHealth(),
      new Promise<boolean>((resolve) => 
        setTimeout(() => {
          console.warn('⚠️  Database health check timed out (5s)');
          resolve(false);
        }, 5000)
      )
    ]);
    
    if (healthCheck) {
      console.log('✅ Database connection verified');
    } else {
      console.warn('⚠️  Database may be slow or unavailable');
      console.warn('   Server will start but queries may timeout');
      console.warn('   Check your DATABASE_URL and ensure database is running');
    }
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    console.warn('   Server will start in degraded mode');
    console.warn('   API requests will fail until database is available');
  }
  
  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(`✓ Server started on http://localhost:${PORT}`);
    console.log(`  Ready to test API endpoints!`);
    console.log(`  Health check: http://localhost:${PORT}/api/health`);
  });
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    server.close(async () => {
      console.log('HTTP server closed');
      
      await closeDbConnections();
      
      console.log('✓ Shutdown complete');
      process.exit(0);
    });
    
    // Force shutdown after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
