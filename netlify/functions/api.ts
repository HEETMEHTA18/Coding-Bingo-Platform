// Test basic server dependencies
export const handler = async (event: any, context: any) => {
  try {
    console.log('Testing basic server dependencies...');

    // Test individual imports that are in server/index.ts
    await import("dotenv/config");
    console.log('dotenv imported');

    const express = (await import("express")).default;
    console.log('express imported');

    await import("cors");
    console.log('cors imported');

    await import("multer");
    console.log('multer imported');

    await import("compression");
    console.log('compression imported');

    await import("helmet");
    console.log('helmet imported');

    const rateLimit = await import("express-rate-limit");
    console.log('express-rate-limit imported');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Basic server dependencies imported successfully!",
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Basic dependencies import error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Basic dependencies import failed',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
