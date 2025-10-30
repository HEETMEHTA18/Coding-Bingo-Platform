import { handleGameState } from "../../server/routes/game.js";

export default async (req, res) => {
  console.log('Game state request:', req.method, req.query, req.body);

  try {
    await handleGameState(req, res);
  } catch (error) {
    console.error('Game state error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};