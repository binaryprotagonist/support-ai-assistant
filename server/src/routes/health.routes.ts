import { Router, Request, Response } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/health", (req: Request, res: Response) => {
  
  const dbState = mongoose.connection.readyState;
  
  const dbStatus = ["disconnected", "connected", "connecting", "disconnecting"][dbState] || "unknown";

  res.json({
    status: "ok",
    service: "support-assistant-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      connected: dbState === 1
    },
    version: "1.0.0"
  });
});

export default router;
