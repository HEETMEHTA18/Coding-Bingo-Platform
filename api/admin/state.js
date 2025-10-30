import { createServer } from "../../server/index.js";

const app = createServer();

export default function handler(req, res) {
  return new Promise((resolve, reject) => {
    // Override the URL to match the expected route
    const originalUrl = req.url;
    req.url = `/api/admin/state${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

    app(req, res, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}