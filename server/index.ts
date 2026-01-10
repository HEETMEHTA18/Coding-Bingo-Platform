import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { checkDbHealth } from "./db.js";
import { handlePing, handleDemo } from "./routes/demo.js";
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
  handleGenerateFakeQuestions,
  handleDeleteQuestionsByType,
  handleDeleteAllQuestions,
  handleDeleteTeam,
  handleDeleteAllTeams,
  handleListRooms,
  handleDeleteRoom,
  handleDeleteAllRooms,
} from "./routes/admin.js";
import { handleLeaderboard, handleLeaderboardAll } from "./routes/leaderboard.js";
import { handleLogin, handleGameState, handleSubmit, handleRecentSubmissions } from "./routes/game.js";
import { 
  handleAuthLogin, 
  handleAuthLogout,
  handleGetCurrentUser,
  handleListAdmins,
  handleCreateAdmin,
  handleUpdateAdmin,
  handleDeleteAdmin,
  handleGetActivityLogs,
  handleGetActiveSessions,
  handleTerminateSession,
  handleGetWebsiteStats,
  handleGetAllTeams,
  handleGetAllQuestions,
  ensureDefaultAdmin 
} from "./routes/auth.js";
import compileRouter from "./routes/compile.js";
import {
  requestTimingMiddleware,
  getRequestTimings,
} from "./middleware/requestTiming.js";

export const createServer = () => {
  const app = express();

  // Ensure default admin exists
  ensureDefaultAdmin().catch(err => console.error("Failed to seed admin:", err));

  // Configure multer for file uploads
  const upload = multer({ storage: multer.memoryStorage() });

  // Security and performance middleware
  const isProduction = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          scriptSrc: isProduction
            ? ["'self'"]
            : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for Vite HMR in development
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: [
            "'self'",
            "http://localhost:*",
            "http://127.0.0.1:*",
            "http://192.168.*",
            "http://172.*",
            "http://10.*",
            "https://*.ngrok-free.app",
            "https://*.ngrok.app",
          ], // Allow WebSocket connections for HMR and API calls from network
        },
      } : false, // Disable CSP in development to avoid network access issues
      crossOriginOpenerPolicy: false, // Disable COOP in development
      crossOriginResourcePolicy: false, // Disable CORP in development
      originAgentCluster: false, // Disable Origin-Agent-Cluster in development
    }),
  );
  app.use(compression());

  // Rate limiting for API endpoints
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000", 10), // limit each IP to requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", limiter);

  // More restrictive rate limiting for game actions
  const gameLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.GAME_RATE_LIMIT_MAX || "60", 10), // limit each IP to game actions per minute
    message: "Too many game actions, please slow down.",
  });
  app.use("/api/login", gameLimiter);
  app.use("/api/submit", gameLimiter);

  // Add middleware
  app.use(requestTimingMiddleware);

  // CORS configuration - allow all origins for development and network access
  const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow localhost and local network IPs
      const allowedOrigins = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
        /^http:\/\/172\.\d+\.\d+\.\d+(:\d+)?$/,
        /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
        /^https:\/\/.*\.ngrok-free\.app$/, // Allow ngrok tunnels
        /^https:\/\/.*\.ngrok\.app$/, // Allow ngrok tunnels
      ];

      const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        callback(null, true); // Allow all for now to prevent issues
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'x-initiated-by', 'x-session-token'],
  };

  app.use(cors(corsOptions));

  // Demo routes (no JSON parsing needed)
  app.get("/api/ping", handlePing);
  app.get("/api/demo", handleDemo);

  // Admin routes
  app.get("/api/admin/state", express.json({ limit: "10mb" }), handleAdminState);
  app.post("/api/admin/create-room", express.json({ limit: "10mb" }), handleCreateRoom);
  app.post("/api/admin/start", express.json({ limit: "10mb" }), handleStartGame);
  app.post("/api/admin/extend-timer", express.json({ limit: "10mb" }), handleExtendTimer);
  app.post("/api/admin/force-end", express.json({ limit: "10mb" }), handleForceEnd);
  app.post("/api/admin/add-question", express.json({ limit: "10mb" }), handleAddQuestion);
  app.post("/api/admin/delete-question", express.json({ limit: "10mb" }), handleDeleteQuestion);
  app.post("/api/admin/upload-questions", handleUploadQuestions); // No JSON parsing for file uploads
  app.post("/api/admin/generate-fake-questions", express.json({ limit: "10mb" }), handleGenerateFakeQuestions);
  app.post("/api/admin/delete-questions-by-type", express.json({ limit: "10mb" }), handleDeleteQuestionsByType);
  app.post("/api/admin/delete-all-questions", express.json({ limit: "10mb" }), handleDeleteAllQuestions);
  app.post("/api/admin/delete-team", express.json({ limit: "10mb" }), handleDeleteTeam);
  app.post("/api/admin/delete-all-teams", express.json({ limit: "10mb" }), handleDeleteAllTeams);
  app.get("/api/admin/rooms", express.json({ limit: "10mb" }), handleListRooms);
  app.post("/api/admin/delete-room", express.json({ limit: "10mb" }), handleDeleteRoom);
  app.post("/api/admin/delete-all-rooms", express.json({ limit: "10mb" }), handleDeleteAllRooms);
  app.post("/api/admin/wipe", express.json({ limit: "10mb" }), handleWipeUserData);

  // Leaderboard routes
  app.get("/api/leaderboard", express.json({ limit: "10mb" }), handleLeaderboard);
  app.get("/api/leaderboard/all", express.json({ limit: "10mb" }), handleLeaderboardAll);

  // Game routes
  app.post("/api/login", express.json({ limit: "10mb" }), handleLogin);
  app.post("/api/auth/login", express.json({ limit: "10mb" }), handleAuthLogin);
  app.post("/api/auth/logout", express.json({ limit: "10mb" }), handleAuthLogout);
  app.get("/api/auth/me", handleGetCurrentUser);
  app.get("/api/game", express.json({ limit: "10mb" }), handleGameState);
  app.post("/api/submit", express.json({ limit: "10mb" }), handleSubmit);
  app.get("/api/recent-submissions", express.json({ limit: "10mb" }), handleRecentSubmissions);

  // Super Admin routes
  app.get("/api/superadmin/admins", handleListAdmins);
  app.post("/api/superadmin/admins", express.json({ limit: "10mb" }), handleCreateAdmin);
  app.put("/api/superadmin/admins", express.json({ limit: "10mb" }), handleUpdateAdmin);
  app.delete("/api/superadmin/admins", express.json({ limit: "10mb" }), handleDeleteAdmin);
  app.get("/api/superadmin/activity-logs", handleGetActivityLogs);
  app.get("/api/superadmin/sessions", handleGetActiveSessions);
  app.post("/api/superadmin/terminate-session", express.json({ limit: "10mb" }), handleTerminateSession);
  app.get("/api/superadmin/stats", handleGetWebsiteStats);
  app.get("/api/superadmin/teams", handleGetAllTeams);
  app.get("/api/superadmin/questions", handleGetAllQuestions);

  // C/C++ Compiler routes (needs JSON parsing)
  app.use(express.json({ limit: "50mb" }), compileRouter);

  // Admin/debug: recent request timings
  app.get("/api/admin/request-timings", (req, res) => {
    res.json({ timings: getRequestTimings() });
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const dbHealthy = await Promise.race([
        checkDbHealth(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000))
      ]);

      res.json({
        status: dbHealthy ? "healthy" : "degraded",
        database: dbHealthy ? "connected" : "timeout",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        database: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Add more routes here...

  return app;
};

// Initialize app
const app = createServer();

// Export for Vercel serverless
export default app;
