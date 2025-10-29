// Test server import without calling createServer
export const handler = async (event: any, context: any) => {
  try {
    console.log('Testing server import without createServer...');

    // Import the server module but don't call createServer
    await import("../../server/index.js");
    console.log('Server index imported successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Server index imported successfully!",
        timestamp: new Date().toISOString(),
        env: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasAdminSecret: !!process.env.ADMIN_SECRET,
        }
      }),
    };
  } catch (error) {
    console.error('Server index import error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Server index import failed',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
