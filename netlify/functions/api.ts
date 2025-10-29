// Test server import
export const handler = async (event: any, context: any) => {
  try {
    console.log('Testing server import...');

    // Try importing the server module
    const serverModule = await import("../../server");
    console.log('Server module imported successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Server module imported successfully!",
        timestamp: new Date().toISOString(),
        hasCreateServer: !!serverModule.createServer,
        env: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasAdminSecret: !!process.env.ADMIN_SECRET,
        }
      }),
    };
  } catch (error) {
    console.error('Server import error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Server import failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
