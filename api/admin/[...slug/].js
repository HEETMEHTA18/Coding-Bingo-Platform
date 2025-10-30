import {
  handleAdminState,
  handleCreateRoom,
  handleStartGame,
  handleExtendTimer,
  handleForceEnd,
  handleAddQuestion,
  handleDeleteQuestion,
  handleUploadQuestions,
  handleWipeUserData,
} from "../../server/routes/admin.ts";

export default async (req, res) => {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug || '';

  console.log('Admin API request:', req.method, req.url, 'path:', path);
  console.log('Environment check:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  });

  try {
    switch (path) {
      case 'state':
        await handleAdminState(req, res);
        break;
      case 'create-room':
        await handleCreateRoom(req, res);
        break;
      case 'start':
        await handleStartGame(req, res);
        break;
      case 'extend-timer':
        await handleExtendTimer(req, res);
        break;
      case 'force-end':
        await handleForceEnd(req, res);
        break;
      case 'add-question':
        await handleAddQuestion(req, res);
        break;
      case 'delete-question':
        await handleDeleteQuestion(req, res);
        break;
      case 'upload-questions':
        // Handle file upload with multer
        const multer = (await import('multer')).default;
        const upload = multer({ storage: multer.memoryStorage() });

        upload.single("file")(req, res, async (err) => {
          if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: 'File upload error' });
          }
          await handleUploadQuestions[1](req, res);
        });
        break;
      case 'wipe':
        await handleWipeUserData(req, res);
        break;
      default:
        res.status(404).json({ error: 'Admin endpoint not found' });
    }
  } catch (error) {
    console.error('Admin API error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};