// Test calling createServer
export const handler = async (event: any, context: any) => {
  try {
    console.log('Testing createServer call...');

    // Import the server module
    const serverModule = await import("../../server/index.js");
    console.log('Server module imported');

    // Try calling createServer
    const app = serverModule.createServer();
    console.log('createServer called successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "createServer called successfully!",
        timestamp: new Date().toISOString(),
        env: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasAdminSecret: !!process.env.ADMIN_SECRET,
        }
      }),
    };
  } catch (error) {
    console.error('createServer error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'createServer failed',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
