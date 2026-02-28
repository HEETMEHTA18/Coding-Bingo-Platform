import { defineConfig } from "vite";
import path from "path";

// Server build configuration
export default defineConfig({
  build: {
    lib: {
      entry: {
        index:   path.resolve(__dirname, "server/index.ts"),
        cluster: path.resolve(__dirname, "server/cluster.ts"),
      },
      formats: ["es"],
    },
    outDir: "dist/server",
    target: "node22",
    ssr: true,
    rollupOptions: {
      external: [
        // Node.js built-ins (bare and node: prefix)
        "fs",       "node:fs",
        "path",     "node:path",
        "url",      "node:url",
        "http",     "node:http",
        "https",    "node:https",
        "os",       "node:os",
        "crypto",   "node:crypto",
        "stream",   "node:stream",
        "util",     "node:util",
        "events",   "node:events",
        "buffer",   "node:buffer",
        "querystring", "node:querystring",
        "child_process", "node:child_process",
        "cluster",  "node:cluster",
        "module",   "node:module",
        "worker_threads", "node:worker_threads",
        // External dependencies that should not be bundled
        "express",
        "cors",
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs",
      },
    },
    minify: "esbuild", // Enable minification for smaller, faster server bundles
    sourcemap: false,  // Disable in production for speed (enable locally if needed)
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
