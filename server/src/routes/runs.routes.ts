import { Router, Request, Response, NextFunction } from "express";
import { WorkflowRun } from "../models/WorkflowRun.js";

const router = Router();

router.get("/runs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const runs = await WorkflowRun.find().sort({ createdAt: -1 }).limit(limit);
    const count = await WorkflowRun.countDocuments();

    res.json({
      success: true,
      totalRuns: count,
      runs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
