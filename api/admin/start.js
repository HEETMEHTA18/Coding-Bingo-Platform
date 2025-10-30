import { handleStartGame } from "../../server/routes/admin.js";

export default async (req, res) => {
  console.log('Start game request:', req.method, req.query, req.body);

  try {
    await handleStartGame(req, res);
  } catch (error) {
    console.error('Start game error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};