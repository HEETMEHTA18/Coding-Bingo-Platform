import { RequestHandler } from "express";

export const handlePing: RequestHandler = (req, res) => {
  res.json({ message: "pong" });
};

export const handleDemo: RequestHandler = (req, res) => {
  res.json({ message: "This is a demo endpoint" });
};
