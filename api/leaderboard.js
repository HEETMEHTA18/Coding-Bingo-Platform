import { handleLeaderboard } from "../server/routes/leaderboard.ts";

export default async (req, res) => {
  console.log('Leaderboard request:', req.method, req.query, req.body);

  try {
    await handleLeaderboard(req, res);
  } catch (error) {
    console.error('Leaderboard error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};