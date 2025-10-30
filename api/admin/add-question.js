import { handleAddQuestion } from "../../server/routes/admin.ts";

export default async (req, res) => {
  console.log('Add question request:', req.method, req.query, req.body);

  try {
    await handleAddQuestion(req, res);
  } catch (error) {
    console.error('Add question error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};