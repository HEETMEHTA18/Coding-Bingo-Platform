import serverless from "serverless-http";
import express from "express";

const app = express();

// Simple test endpoint
app.get("/test", (req, res) => {
  res.json({
    message: "Serverless function is working!",
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasAdminSecret: !!process.env.ADMIN_SECRET,
    }
  });
});

// Ping endpoint
app.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: new Date().toISOString() });
});

export const handler = serverless(app);