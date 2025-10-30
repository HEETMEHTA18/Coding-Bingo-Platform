import { handleCreateRoom } from "../../server/routes/admin.ts";

export default async (req, res) => {
  console.log('Create room request:', req.method, req.query, req.body);
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    await handleCreateRoom(req, res);
  } catch (error) {
    console.error('Create room error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};