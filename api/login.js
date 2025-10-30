import { handleLogin } from "../../server/routes/game.js";

export default async (req, res) => {
  console.log('Login request:', req.method, req.query, req.body);

  try {
    await handleLogin(req, res);
  } catch (error) {
    console.error('Login error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};