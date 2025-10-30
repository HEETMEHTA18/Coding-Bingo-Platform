import multer from "multer";
import { handleUploadQuestions } from "../../server/routes/admin.ts";

const upload = multer({ storage: multer.memoryStorage() });

export default async (req, res) => {
  console.log('Upload questions request:', req.method, req.query, req.body);

  try {
    // Apply multer middleware manually for Vercel
    const multerMiddleware = upload.single("file");

    multerMiddleware(req, res, async (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: 'File upload error' });
      }

      // Now call the actual handler
      await handleUploadQuestions[1](req, res);
    });
  } catch (error) {
    console.error('Upload questions error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};