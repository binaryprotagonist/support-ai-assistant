import { SupportStateType } from "./state.js";

export function shouldContinueAfterApproval(state: SupportStateType): "sendReply" | "reviseAnswer" {
  if (state.reviewerDecision === "approved") {
    return "sendReply";
  }

  if (state.reviewerDecision === "rejected") {
    if (state.revisionCount < 2) {
      return "reviseAnswer";
    }
    // Max 2 revisions reached, proceed to send with notice
    console.log(`[LangGraph Edge] Max 2 revisions reached for thread ${state.threadId}. Proceeding to send.`);
    
    return "sendReply";
  }

  // Default to send if approved
  return "sendReply";
}
