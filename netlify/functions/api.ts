// Test minimal server creation
export const handler = async (event: any, context: any) => {
  try {
    console.log('Testing minimal server creation...');

    // Try creating a minimal express server
    const express = (await import("express")).default;
    const app = express();

    app.get('/api/test', (req, res) => {
      res.json({ message: 'Minimal server works!' });
    });

    // Try serverless-http
    const serverless = (await import("serverless-http")).default;
    const handler = serverless(app);

    // Call the handler directly for testing
    return await handler(event, context);

  } catch (error) {
    console.error('Minimal server error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Minimal server creation failed',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
