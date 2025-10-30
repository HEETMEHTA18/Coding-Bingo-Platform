import { handleWipeUserData } from "../../server/routes/admin.ts";

export default async (req, res) => {
  console.log('Wipe user data request:', req.method, req.query, req.body);

  try {
    await handleWipeUserData(req, res);
  } catch (error) {
    console.error('Wipe user data error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};