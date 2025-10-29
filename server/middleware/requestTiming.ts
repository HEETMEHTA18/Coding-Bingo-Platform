import { RequestHandler } from "express";

type ReqEntry = {
  time: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
};

const MAX_ENTRIES = 1000;
const entries: ReqEntry[] = [];

export const requestTimingMiddleware: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const e: ReqEntry = {
      time: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
    };
    entries.push(e);
    if (entries.length > MAX_ENTRIES) entries.shift();
  });
  next();
};

export function getRequestTimings() {
  return entries.slice().reverse(); // newest first
}
