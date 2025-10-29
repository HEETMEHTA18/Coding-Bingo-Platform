// Simple API function to test imports
export const handler = async (event: any, context: any) => {
  try {
    // Test basic import
    console.log('Testing server import...');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "API function loaded successfully!",
        timestamp: new Date().toISOString(),
        env: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasAdminSecret: !!process.env.ADMIN_SECRET,
        }
      }),
    };
  } catch (error) {
    console.error('API function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'API function failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
