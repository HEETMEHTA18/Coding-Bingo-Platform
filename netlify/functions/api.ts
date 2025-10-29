// Simple API function for debugging
export const handler = async (event: any, context: any) => {
  console.log('API Function called:', event.path, event.httpMethod);

  // Handle different routes
  if (event.path === '/api/admin/create-room' && event.httpMethod === 'POST') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Admin create-room endpoint working!",
        timestamp: new Date().toISOString(),
        path: event.path,
        method: event.httpMethod
      }),
    };
  }

  if (event.path === '/api/admin/state' && event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Admin state endpoint working!",
        timestamp: new Date().toISOString(),
        path: event.path,
        method: event.httpMethod
      }),
    };
  }

  // Default response
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: "API function is working!",
      timestamp: new Date().toISOString(),
      path: event.path,
      method: event.httpMethod,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasAdminSecret: !!process.env.ADMIN_SECRET,
      }
    }),
  };
};
