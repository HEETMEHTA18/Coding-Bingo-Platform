// Simple serverless function without express
export const handler = async (event: any, context: any) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: "Serverless function is working!",
      timestamp: new Date().toISOString(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasAdminSecret: !!process.env.ADMIN_SECRET,
        databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      }
    }),
  };
};