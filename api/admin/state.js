import { handleAdminState } from "../../server/routes/admin.js";

export default async (req, res) => {
  console.log('Admin state request:', req.method, req.query, req.body);
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    await handleAdminState(req, res);
  } catch (error) {
    console.error('Admin state error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};