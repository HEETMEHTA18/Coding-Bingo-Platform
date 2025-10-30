import { handleForceEnd } from "../../server/routes/admin.ts";

export default async (req, res) => {
  console.log('Force end request:', req.method, req.query, req.body);

  try {
    await handleForceEnd(req, res);
  } catch (error) {
    console.error('Force end error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};