import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import crypto from "crypto";
import { connectDatabase, disconnectDatabase } from "../../src/config/database.js";
import { createSupportWorkflow } from "../../src/modules/workflow/graph.js";
import { setWorkflowLLMClient } from "../../src/modules/workflow/nodes.js";
import { LLMClient } from "../../src/modules/llm/LLMClient.js";
import { StubFlakyProvider } from "../../src/modules/llm/providers/StubFlakyProvider.js";
import { PersistentDurableSaver } from "../../src/modules/workflow/checkpointer.js";
import { defaultRetrievalService } from "../../src/modules/retrieval/retrievalService.js";

describe("Part 3: Workflow - HITL Interrupt, Persistent Checkpoint, Process-Kill & Revision Loop", () => {
  const testStorageDir = path.resolve(__dirname, "..", "..", "data", "test_checkpoints");

  beforeAll(async () => {
    await connectDatabase();
    const docsDir = path.resolve(__dirname, "..", "..", "..", "documents");
    await defaultRetrievalService.initialize(docsDir);

    // Provide reliable stub for testing deterministic flow
    const testStub = new StubFlakyProvider("workflow-stub", {
      rateLimitRate: 0,
      timeoutRate: 0,
      malformedJsonRate: 0,
      serverErrorRate: 0,
      defaultResponseContent: JSON.stringify({
        answer: "Full-time employees receive 25 days of annual paid leave, accrued at 2.08 days per month.",
        citations: [{ chunkId: "leave-policy-chunk-1", quote: "25 days of paid annual leave per calendar year" }],
        confidence: 0.98
      })
    });

    setWorkflowLLMClient(new LLMClient({ primaryProvider: testStub, maxRetries: 1 }));
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("should pause at human approval, survive process destruction, resume cleanly, execute revision loop, and send", async () => {
    const threadId = `kill_test_${crypto.randomUUID()}`;
    const config = { configurable: { thread_id: threadId } };

    // --- PHASE A: Run until human approval interrupt in Instance 1 ---
    const checkpointer1 = new PersistentDurableSaver(testStorageDir);
    let workflowInstance1: any = createSupportWorkflow(checkpointer1);

    console.log(`[Test] Starting workflow on Process/Instance 1 for thread ${threadId}...`);
    const interruptedState = await workflowInstance1.invoke(
      {
        question: "How many days of paid annual leave do full-time employees receive?",
        threadId,
        revisionCount: 0,
        sent: false
      },
      config
    );

    // Assert graph paused at humanApproval interrupt
    expect(interruptedState.draft).toBeDefined();
    expect(interruptedState.draft.length).toBeGreaterThan(10);
    expect(interruptedState.citations.length).toBeGreaterThan(0);
    expect(interruptedState.sent).toBe(false);
    expect(interruptedState.revisionCount).toBe(0);
    console.log(`[Test] Instance 1 paused at Human Approval. Draft generated: "${interruptedState.draft.substring(0, 50)}..."`);

    // --- PHASE B: SIMULATE PROCESS KILL ---
    console.log("[Test] >>> KILLING PROCESS / DESTROYING INSTANCE 1 <<<");
    workflowInstance1 = null; // Garbage collect / simulate process exit

    // --- PHASE C: RESTART - New process instance loads state from disk/Mongo ---
    console.log("[Test] >>> RESTARTING NEW PROCESS / INSTANCE 2 <<<");
    const checkpointer2 = new PersistentDurableSaver(testStorageDir);
    const workflowInstance2 = createSupportWorkflow(checkpointer2);

    // Fetch checkpoint from cold storage
    const savedTuple = await checkpointer2.getTuple(config);
    expect(savedTuple).toBeDefined();
    expect(savedTuple?.checkpoint).toBeDefined();

    const recoveredChannelValues = savedTuple?.checkpoint.channel_values as any;
    expect(recoveredChannelValues.question).toBe("How many days of paid annual leave do full-time employees receive?");
    expect(recoveredChannelValues.draft).toBe(interruptedState.draft);
    expect(recoveredChannelValues.sent).toBe(false);
    console.log("[Test] Checkpoint successfully verified after cold restart!");

    // --- PHASE D: REVISION LOOP (Human Reviewer Rejection with Feedback) ---
    console.log("[Test] Submitting rejection with reviewer feedback...");
    await workflowInstance2.updateState(config, {
      reviewerDecision: "rejected",
      reviewerFeedback: "Please explicitly state how many days can be carried over into next year."
    });

    // Resume execution: should route through reviseAnswer -> draftAnswer -> humanApproval
    const revisedState = await workflowInstance2.invoke(null, config);
    expect(revisedState.revisionCount).toBe(1);
    expect(revisedState.sent).toBe(false);
    console.log(`[Test] Revision loop executed successfully! Current revision count: ${revisedState.revisionCount}`);

    // --- PHASE E: HUMAN APPROVAL & SEND ---
    console.log("[Test] Submitting final approval from human reviewer...");
    await workflowInstance2.updateState(config, {
      reviewerDecision: "approved"
    });

    // Resume execution past interrupt -> routes to sendReply -> END
    const finalState = await workflowInstance2.invoke(null, config);
    expect(finalState.sent).toBe(true);
    console.log("[Test] Workflow successfully completed sendReply after approval!");

    // Assert final state survives and is marked sent
    const finalTuple = await checkpointer2.getTuple(config);
    const finalChannels = finalTuple?.checkpoint.channel_values as any;
    expect(finalChannels.sent).toBe(true);
  });
});
