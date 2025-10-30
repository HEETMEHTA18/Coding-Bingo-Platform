import { handleLeaderboard, handleLeaderboardAll } from "../../server/routes/leaderboard.ts";

export default async (req, res) => {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug || '';

  console.log('Leaderboard API request:', req.method, req.url, 'path:', path);
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    switch (path) {
      case '':
        await handleLeaderboard(req, res);
        break;
      case 'all':
        await handleLeaderboardAll(req, res);
        break;
      default:
        res.status(404).json({ error: 'Leaderboard endpoint not found' });
    }
  } catch (error) {
    console.error('Leaderboard API error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};