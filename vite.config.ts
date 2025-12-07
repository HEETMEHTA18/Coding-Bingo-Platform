import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Bind to all IPv4 interfaces by default to be compatible with tunnels (ngrok) and Docker
    host: process.env.DEV_HOST || "0.0.0.0",
    port: 8080,
    // Allow additional hosts (comma-separated) for temporary tunnels like ngrok
    // Example: set ALLOWED_HOSTS=675fd24d6f73.ngrok-free.app
    allowedHosts: (process.env.ALLOWED_HOSTS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    fs: {
      allow: ["./client", "./shared", "./index.html"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "framer-motion"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-slot", "@radix-ui/react-toast", "lucide-react"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          editor: ["@monaco-editor/react"],
        },
      },
    },
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      // Dynamic import to avoid loading server during build
      const { createServer } = await import("./server/index.js");
      const app = createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
