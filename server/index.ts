import "dotenv/config";
import { createServer as createHttpServer } from "http";
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
  handleSeedQuestions,
} from "./routes/admin.js";
import { handleLeaderboard, handleLeaderboardAll } from "./routes/leaderboard.js";
import { handleLogin, handleGameState, handleSubmit, handleRecentSubmissions, handleTicTacToeAction, handleTicTacToeStream, handleAdminPushBonus, handleTTTBonusSubmit, handleAdminTTTState, handleSpectate, handleGameStream } from './routes/game.js';
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
import { handleMasterState } from "./routes/master.js";
import {
  requestTimingMiddleware,
  getRequestTimings,
} from "./middleware/requestTiming.js";

export const createServer = () => {
  const app = express();

  // Trust the Nginx reverse-proxy so req.ip reflects the real client IP
  // (required for accurate rate limiting when behind a proxy)
  app.set('trust proxy', 1);

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
  app.use(compression({ level: 6, threshold: 1024 })); // gzip level 6, skip tiny responses

  // Global JSON body parser – all routes share one instance (avoids per-route overhead).
  // The compiler route overrides this with a higher 50 MB limit below.
  app.use(express.json({ limit: "10mb" }));

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
  app.get("/api/admin/state", handleAdminState);
  app.post("/api/admin/create-room", handleCreateRoom);
  app.post("/api/admin/start", handleStartGame);
  app.post("/api/admin/extend-timer", handleExtendTimer);
  app.post("/api/admin/force-end", handleForceEnd);
  app.post("/api/admin/add-question", handleAddQuestion);
  app.post("/api/admin/delete-question", handleDeleteQuestion);
  app.post("/api/admin/upload-questions", handleUploadQuestions); // No JSON parsing for file uploads
  app.post("/api/admin/generate-fake-questions", handleGenerateFakeQuestions);
  app.post("/api/admin/delete-questions-by-type", handleDeleteQuestionsByType);
  app.post("/api/admin/delete-all-questions", handleDeleteAllQuestions);
  app.post("/api/admin/delete-team", handleDeleteTeam);
  app.post("/api/admin/delete-all-teams", handleDeleteAllTeams);
  app.get("/api/admin/rooms", handleListRooms);
  app.post("/api/admin/delete-room", handleDeleteRoom);
  app.post("/api/admin/delete-all-rooms", handleDeleteAllRooms);
  app.post("/api/admin/wipe", handleWipeUserData);
  app.post("/api/admin/seed-questions", handleSeedQuestions);

  // Leaderboard routes
  app.get("/api/leaderboard", handleLeaderboard);
  app.get("/api/leaderboard/all", handleLeaderboardAll);

  // Game routes
  app.post("/api/login", handleLogin);
  app.post("/api/auth/login", handleAuthLogin);
  app.post("/api/auth/logout", handleAuthLogout);
  app.get("/api/auth/me", handleGetCurrentUser);
  app.get("/api/game", handleGameState);
  app.get("/api/game/stream", handleGameStream); // SSE: instant board push on correct submissions
  app.post("/api/submit", handleSubmit);
  app.get("/api/recent-submissions", handleRecentSubmissions);
  app.post("/api/tictactoe/action", handleTicTacToeAction);
  app.get("/api/tictactoe/stream", handleTicTacToeStream); // SSE: real-time board updates
  app.post("/api/admin/ttt-bonus", handleAdminPushBonus); // Admin pushes live bonus
  app.post("/api/tictactoe/bonus-submit", handleTTTBonusSubmit); // Team submits bonus answer
  app.get("/api/admin/ttt-state", handleAdminTTTState); // Admin reads TTT board state
  app.get("/api/spectate", handleSpectate); // Spectator: full live board state

  // Super Admin routes
  app.get("/api/superadmin/admins", handleListAdmins);
  app.post("/api/superadmin/admins", handleCreateAdmin);
  app.put("/api/superadmin/admins", handleUpdateAdmin);
  app.delete("/api/superadmin/admins", handleDeleteAdmin);
  app.get("/api/superadmin/activity-logs", handleGetActivityLogs);
  app.get("/api/superadmin/sessions", handleGetActiveSessions);
  app.post("/api/superadmin/terminate-session", handleTerminateSession);
  app.get("/api/superadmin/stats", handleGetWebsiteStats);
  app.get("/api/superadmin/teams", handleGetAllTeams);
  app.get("/api/superadmin/questions", handleGetAllQuestions);

  // C/C++ Compiler routes (50 MB limit overrides the global 10 MB parser)
  app.use(express.json({ limit: "50mb" }), compileRouter);

  // Admin/debug: recent request timings
  app.get("/api/admin/request-timings", (req, res) => {
    res.json({ timings: getRequestTimings() });
  });

  app.get("/api/master/state", handleMasterState);

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

// Start HTTP server when run directly (e.g. Docker / node dist/server/index.mjs)
// In Vercel, this module is imported, not run directly, so this block is skipped.
const PORT = parseInt(process.env.PORT || "8080", 10);

const httpServer = createHttpServer(app);

// Keep-alive tuning: allows connection reuse from Nginx keepalive pool.
// headersTimeout must be > keepAliveTimeout to avoid race-condition 503s.
httpServer.keepAliveTimeout = 65_000;   // match Nginx keepalive_timeout 65
httpServer.headersTimeout   = 70_000;   // 5 s grace above keepAliveTimeout

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
});
