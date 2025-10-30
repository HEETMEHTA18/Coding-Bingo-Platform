import { handleExtendTimer } from "../../server/routes/admin.js";

export default async (req, res) => {
  console.log('Extend timer request:', req.method, req.query, req.body);

  try {
    await handleExtendTimer(req, res);
  } catch (error) {
    console.error('Extend timer error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};