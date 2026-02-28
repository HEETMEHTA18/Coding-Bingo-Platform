/**
 * cluster.ts – Process-cluster entry point
 *
 * Forks one worker per available CPU core so the app can use all cores.
 * Nginx must be configured with `ip_hash` (sticky sessions) so that a
 * client's SSE stream and subsequent API calls land on the same worker.
 *
 * Usage (production): node dist/server/cluster.mjs
 * Dev:                vite dev (runs server/index.ts directly, no cluster)
 */

import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import { createRequire } from "node:module";

const NUM_WORKERS = Math.max(
  2, // Always spin up at least 2 workers
  Math.min(availableParallelism(), 4) // Cap at 4 to avoid OOM in containers
);

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} – forking ${NUM_WORKERS} workers`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  // Automatically restart crashed workers
  cluster.on("exit", (worker, code, signal) => {
    const reason = signal ?? `exit code ${code}`;
    console.warn(`[cluster] Worker ${worker.process.pid} died (${reason}). Restarting...`);
    cluster.fork();
  });

  // Graceful shutdown: forward SIGTERM to all workers
  process.on("SIGTERM", () => {
    console.log("[cluster] SIGTERM received – shutting down workers gracefully");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill("SIGTERM");
    }
  });
} else {
  // Worker process: load and start the real server
  // Dynamic import keeps this file importable during tests without side-effects.
  await import("./index.js");
  console.log(`[cluster] Worker ${process.pid} ready`);
}
