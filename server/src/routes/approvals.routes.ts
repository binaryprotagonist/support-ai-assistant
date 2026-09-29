import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { defaultApprovalService } from "../modules/approval/approval.service.js";

const router = Router();

const rejectBodySchema = z.object({
  feedback: z.string().min(3, "Feedback must be at least 3 characters long"),
  reviewer: z.string().optional()
});

router.get("/approvals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await defaultApprovalService.getPendingApprovals();
    res.json({ success: true, count: pending.length, approvals: pending });
  } catch (error) {
    next(error);
  }
});

router.get("/approvals/:threadId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await defaultApprovalService.getApprovalByThread(req.params.threadId);
    if (!item) {
      return res.status(404).json({ success: false, error: "Approval not found" });
    }
    res.json({ success: true, approval: item });
  } catch (error) {
    next(error);
  }
});

router.post("/approvals/:threadId/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewer = req.body?.reviewer || "admin-reviewer";
    const result = await defaultApprovalService.approve(req.params.threadId, reviewer);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/approvals/:threadId/reject", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedback, reviewer } = rejectBodySchema.parse(req.body);
    const result = await defaultApprovalService.reject(req.params.threadId, feedback, reviewer);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
