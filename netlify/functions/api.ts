// Simple API function for debugging
export const handler = async (event: any, context: any) => {
  console.log('API Function called:', event.path, event.httpMethod);

  // Extract the API path (remove the function base path)
  const apiPath = event.path.replace('/.netlify/functions/api', '') || '/';

  console.log('Extracted API path:', apiPath);

  // Handle different routes
  if (apiPath === '/admin/create-room' && event.httpMethod === 'POST') {
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

  if (apiPath === '/admin/state' && event.httpMethod === 'GET') {
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
