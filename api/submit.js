import { handleSubmit } from "../server/routes/game.ts";

export default async (req, res) => {
  console.log('Submit request:', req.method, req.query, req.body);

  try {
    await handleSubmit(req, res);
  } catch (error) {
    console.error('Submit error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};