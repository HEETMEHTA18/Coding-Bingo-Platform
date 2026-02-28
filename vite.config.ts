import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: process.env.DEV_HOST || "0.0.0.0",
    port: 8080,
    allowedHosts: (process.env.ALLOWED_HOSTS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    fs: {
      allow: ["./client", "./shared", "./index.html", "./node_modules"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
    // Faster HMR
    hmr: { overlay: true },
  },
  build: {
    outDir: "dist",
    // Increase chunk size limit warning threshold
    chunkSizeWarningLimit: 1000,
    // Skip reporting gzip sizes during build – speeds up CI significantly
    reportCompressedSize: false,
    // Inline assets < 4 KB as base64 to save round-trips
    assetsInlineLimit: 4096,
    // Enable CSS code splitting (each async chunk gets its own CSS file)
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Fine-grained manual chunks for better caching & parallel loading
        manualChunks(id) {
          if (id.includes("node_modules/@monaco-editor") || id.includes("node_modules/monaco-editor")) {
            return "monaco";
          }
          if (id.includes("node_modules/react-dom")) return "react-dom";
          if (id.includes("node_modules/react-router")) return "react-router";
          if (id.includes("node_modules/react")) return "react";
          if (id.includes("node_modules/lucide-react")) return "lucide";
          if (id.includes("node_modules/@radix-ui")) return "radix";
          if (id.includes("node_modules/framer-motion")) return "framer";
          if (id.includes("node_modules/react-syntax-highlighter")) return "syntax-hl";
          if (id.includes("node_modules/react-confetti")) return "confetti";
          if (id.includes("node_modules/")) return "vendor";
        },
        // Content-hash filenames for long-lived caching
        chunkFileNames:  "assets/[name]-[hash].js",
        entryFileNames:  "assets/[name]-[hash].js",
        assetFileNames:  "assets/[name]-[hash][extname]",
      },
    },
    // esbuild minification – faster and smaller than Terser
    minify: "esbuild",
    target: "es2020",
    sourcemap: mode === "development",
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "lucide-react",
      "framer-motion",
      "react-confetti",
    ],
    exclude: ["@monaco-editor/react"],
    // Experimental: esbuild options for faster pre-bundling
    esbuildOptions: {
      target: "es2020",
    },
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  // Enable CSS code splitting
  css: {
    devSourcemap: mode === "development",
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    async configureServer(server) {
      const { createServer } = await import("./server/index.js");
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}
