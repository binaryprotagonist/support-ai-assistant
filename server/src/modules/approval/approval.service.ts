import mongoose from "mongoose";
import { Approval, IApproval } from "../../models/Approval.js";
import { WorkflowRun } from "../../models/WorkflowRun.js";
import { supportWorkflow } from "../workflow/graph.js";

export class ApprovalService {
  public async getPendingApprovals(): Promise<any[]> {
    const list = await Approval.find({ status: "pending" })
      .populate("workflowRunId", "question category confidence latencyMs createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return await Promise.all(
      list.map(async (item: any) => {
        let question = item.workflowRunId?.question;
        let category = item.workflowRunId?.category;
        let confidence = item.workflowRunId?.confidence;

        if (!question && item.threadId) {
          const run = await WorkflowRun.findOne({ threadId: item.threadId }).lean();
          if (run) {
            question = run.question;
            category = category || run.category;
            confidence = confidence !== undefined ? confidence : run.confidence;
          }
        }

        return {
          ...item,
          question,
          category,
          confidence
        };
      })
    );
  }

  public async getApprovalByThread(threadId: string): Promise<any | null> {
    const item = await Approval.findOne({ threadId })
      .populate("workflowRunId", "question category confidence latencyMs createdAt")
      .lean();

    if (!item) return null;

    let question = (item as any).workflowRunId?.question;
    let category = (item as any).workflowRunId?.category;
    let confidence = (item as any).workflowRunId?.confidence;

    if (!question && (item as any).threadId) {
      const run = await WorkflowRun.findOne({ threadId: (item as any).threadId }).lean();
      if (run) {
        question = run.question;
        category = category || run.category;
        confidence = confidence !== undefined ? confidence : run.confidence;
      }
    }

    return {
      ...item,
      question,
      category,
      confidence
    };
  }

  public async approve(threadId: string, reviewer = "admin-reviewer"): Promise<{ success: boolean; threadId: string; status: string }> {
    console.log(`[ApprovalService] Approving draft for thread: ${threadId}...`);

    // 1. Update Approval record in DB
    const approval = await Approval.findOne(
      mongoose.isValidObjectId(threadId)
        ? { $or: [{ threadId }, { _id: threadId }] }
        : { threadId }
    );

    if (!approval) {
      throw new Error(`No approval record found for identifier: ${threadId}`);
    }

    const actualThreadId = approval.threadId;

    approval.status = "approved";
    approval.reviewedBy = reviewer;
    approval.reviewedAt = new Date();
    await approval.save();

    // 2. Resume LangGraph workflow execution with approved decision
    const config = { configurable: { thread_id: actualThreadId } };
    
    // Update state with reviewer decision
    await supportWorkflow.updateState(config, {
      reviewerDecision: "approved"
    });

    // Resume execution past interrupt
    const finalState = await supportWorkflow.invoke(null, config);

    return {
      success: true,
      threadId,
      status: finalState.sent ? "completed" : "processing"
    };
  }

  public async reject(
    threadId: string,
    feedback: string,
    reviewer = "admin-reviewer"
  ): Promise<{ success: boolean; threadId: string; revisionCount: number; status: string; newDraft?: string }> {
    console.log(`[ApprovalService] Rejecting draft for thread: ${threadId} with feedback: "${feedback}"...`);

    const approval = await Approval.findOne(
      mongoose.isValidObjectId(threadId)
        ? { $or: [{ threadId }, { _id: threadId }] }
        : { threadId }
    );

    if (!approval) {
      throw new Error(`No approval record found for identifier: ${threadId}`);
    }

    const actualThreadId = approval.threadId;

    approval.status = "rejected";
    approval.feedback = feedback;
    approval.reviewedBy = reviewer;
    approval.reviewedAt = new Date();
    await approval.save();

    // Resume LangGraph workflow execution with revision feedback
    const config = { configurable: { thread_id: actualThreadId } };
    
    await supportWorkflow.updateState(config, {
      reviewerDecision: "rejected",
      reviewerFeedback: feedback
    });

    // Resume execution through reviseAnswer -> draftAnswer -> next humanApproval interrupt
    const nextState = await supportWorkflow.invoke(null, config);

    return {
      success: true,
      threadId,
      revisionCount: nextState.revisionCount,
      status: nextState.sent ? "completed" : "waiting_approval",
      newDraft: nextState.draft
    };
  }
}

export const defaultApprovalService = new ApprovalService();
