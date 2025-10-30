import { handleLogin, handleGameState, handleSubmit } from "../../server/routes/game.ts";

export default async (req, res) => {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug || '';

  console.log('Game API request:', req.method, req.url, 'path:', path);
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    switch (path) {
      case 'login':
        await handleLogin(req, res);
        break;
      case 'game-state':
        await handleGameState(req, res);
        break;
      case 'submit':
        await handleSubmit(req, res);
        break;
      default:
        res.status(404).json({ error: 'Game endpoint not found' });
    }
  } catch (error) {
    console.error('Game API error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};