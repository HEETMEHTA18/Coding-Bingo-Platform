// Simple API function for debugging
export const handler = async (event: any, context: any) => {
  console.log('API Function called:', event.path, event.httpMethod);

  // The event.path should already be the API path thanks to the redirect
  const apiPath = event.path;

  console.log('API path:', apiPath);

  // Handle different routes
  if (apiPath === '/api/admin/create-room' && event.httpMethod === 'POST') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Admin create-room endpoint working!",
        timestamp: new Date().toISOString(),
        apiPath: apiPath,
        method: event.httpMethod
      }),
    };
  }

  if (apiPath === '/api/admin/state' && event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Admin state endpoint working!",
        timestamp: new Date().toISOString(),
        apiPath: apiPath,
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
      apiPath: apiPath,
      method: event.httpMethod,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasAdminSecret: !!process.env.ADMIN_SECRET,
      }
    }),
  };
};
