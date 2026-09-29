import { StateGraph, START, END } from "@langchain/langgraph";
import { SupportState } from "./state.js";
import {
  classifyQuestionNode,
  retrieveContextNode,
  draftAnswerNode,
  humanApprovalNode,
  reviseAnswerNode,
  sendReplyNode
} from "./nodes.js";
import { shouldContinueAfterApproval } from "./edges.js";
import { defaultCheckpointer, PersistentDurableSaver } from "./checkpointer.js";
import { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

export function createSupportWorkflow(customCheckpointer?: BaseCheckpointSaver) {
  const checkpointer = customCheckpointer || defaultCheckpointer;

  const workflow = new StateGraph(SupportState)
    .addNode("classifyQuestion", classifyQuestionNode)
    .addNode("retrieveContext", retrieveContextNode)
    .addNode("draftAnswer", draftAnswerNode)
    .addNode("humanApproval", humanApprovalNode)
    .addNode("reviseAnswer", reviseAnswerNode)
    .addNode("sendReply", sendReplyNode)

    // Flow edges
    .addEdge(START, "classifyQuestion")
    .addEdge("classifyQuestion", "retrieveContext")
    .addEdge("retrieveContext", "draftAnswer")
    .addEdge("draftAnswer", "humanApproval")

    // Conditional edge after human approval
    .addConditionalEdges("humanApproval", shouldContinueAfterApproval, {
      sendReply: "sendReply",
      reviseAnswer: "reviseAnswer"
    })

    // Revision loop back to draftAnswer
    .addEdge("reviseAnswer", "draftAnswer")
    .addEdge("sendReply", END);

  return workflow.compile({
    checkpointer,
    interruptBefore: ["humanApproval"]
  });
}

export const supportWorkflow = createSupportWorkflow();
