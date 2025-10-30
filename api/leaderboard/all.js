import { handleLeaderboardAll } from "../../server/routes/leaderboard.ts";

export default async (req, res) => {
  console.log('Leaderboard all request:', req.method, req.query, req.body);

  try {
    await handleLeaderboardAll(req, res);
  } catch (error) {
    console.error('Leaderboard all error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};