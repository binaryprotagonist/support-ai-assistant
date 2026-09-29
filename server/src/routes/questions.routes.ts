import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import crypto from "crypto";
import { WorkflowRun } from "../models/WorkflowRun.js";
import { supportWorkflow } from "../modules/workflow/graph.js";

const router = Router();

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string()
});

const questionInputSchema = z.object({
  question: z.string().min(1, "Question must not be empty"),
  threadId: z.string().optional(),
  history: z.array(chatTurnSchema).optional()
});

router.post("/questions", async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  try {
    const { question, threadId, history } = questionInputSchema.parse(req.body);
    const activeThreadId = threadId || `thread_${crypto.randomUUID()}`;

    // Create or update workflow run record in MongoDB
    let run = await WorkflowRun.findOneAndUpdate(
      { threadId: activeThreadId },
      {
        question,
        status: "processing",
        currentStep: "received",
        revisionCount: 0,
        sent: false
      },
      { upsert: true, new: true }
    );

    // Execute LangGraph workflow until the human approval checkpoint
    const config = { configurable: { thread_id: activeThreadId } };

    const state = await supportWorkflow.invoke(
      {
        question,
        history: history || [],
        threadId: activeThreadId,
        revisionCount: 0,
        sent: false
      },
      config
    );

    const latencyMs = Date.now() - startTime;

    // Fetch and update the run record with calculated latency
    const updatedRun = await WorkflowRun.findOneAndUpdate(
      { threadId: activeThreadId },
      { latencyMs },
      { new: true }
    );

    res.status(202).json({
      success: true,
      message: "Question processed up to human approval checkpoint",
      threadId: activeThreadId,
      runId: updatedRun?._id || run._id,
      status: updatedRun?.status || "waiting_approval",
      draft: state.draft,
      citations: state.citations,
      category: state.category,
      latencyMs
    });
  } catch (error) {
    next(error);
  }
});

router.get("/questions/:threadId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const run = await WorkflowRun.findOne({ threadId: req.params.threadId });
    if (!run) {
      return res.status(404).json({ success: false, error: "Workflow run not found" });
    }
    res.json({ success: true, run });
  } catch (error) {
    next(error);
  }
});

export default router;
