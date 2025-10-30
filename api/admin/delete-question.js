import { handleDeleteQuestion } from "../../server/routes/admin.ts";

export default async (req, res) => {
  console.log('Delete question request:', req.method, req.query, req.body);

  try {
    await handleDeleteQuestion(req, res);
  } catch (error) {
    console.error('Delete question error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};