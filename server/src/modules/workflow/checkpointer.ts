import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
  ChannelVersions,
  PendingWrite
} from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// Mongoose schema for persistent LangGraph checkpoints
const CheckpointSchema = new mongoose.Schema(
  {
    threadId: { type: String, required: true, index: true },
    checkpointId: { type: String, required: true },
    parentCheckpointId: { type: String },
    checkpoint: { type: mongoose.Schema.Types.Mixed, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    writes: { type: [mongoose.Schema.Types.Mixed], default: [] }
  },
  { timestamps: true }
);

CheckpointSchema.index({ threadId: 1, checkpointId: 1 }, { unique: true });

export const MongoCheckpoint = mongoose.models.MongoCheckpoint || mongoose.model("MongoCheckpoint", CheckpointSchema);

export class PersistentDurableSaver extends BaseCheckpointSaver {
  private fallbackDir: string;

  constructor(storageDir?: string) {
    super();

    const defaultDir = process.env.VERCEL
      ? path.join("/tmp", "checkpoints")
      : path.resolve(process.cwd(), "data", "checkpoints");

    this.fallbackDir = storageDir || defaultDir;

    try {
      if (!fs.existsSync(this.fallbackDir)) {
        fs.mkdirSync(this.fallbackDir, { recursive: true });
      }
    } catch {
      // If filesystem is read-only outside /tmp, fallback to /tmp
      this.fallbackDir = path.join("/tmp", "checkpoints");
      try {
        if (!fs.existsSync(this.fallbackDir)) {
          fs.mkdirSync(this.fallbackDir, { recursive: true });
        }
      } catch {
        // Safe no-op, MongoDB is the primary persistent store
      }
    }
  }

  private getFilePath(threadId: string): string {
    const safeThread = threadId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.fallbackDir, `${safeThread}.json`);
  }

  public async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return undefined;

    // 1. Fast-path Durable Disk File (sub-millisecond local read)
    const filePath = this.getFilePath(threadId);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw);
        if (!config.configurable?.checkpoint_id || data.checkpointId === config.configurable.checkpoint_id) {
          return {
            config,
            checkpoint: data.checkpoint,
            metadata: data.metadata,
            parentConfig: data.parentCheckpointId
              ? { configurable: { thread_id: threadId, checkpoint_id: data.parentCheckpointId } }
              : undefined,
            pendingWrites: data.writes || []
          };
        }
      } catch (err: any) {
        console.warn("[PersistentDurableSaver] Error reading disk checkpoint:", err.message);
      }
    }

    // 2. Try MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const query: any = { threadId };
        
        if (config.configurable?.checkpoint_id) {
          query.checkpointId = config.configurable.checkpoint_id;
        }

        const record = await MongoCheckpoint.findOne(query).sort({ createdAt: -1 });
        
        if (record) {
          return {
            config,
            checkpoint: record.checkpoint as Checkpoint,
            metadata: record.metadata as CheckpointMetadata,
            parentConfig: record.parentCheckpointId
              ? { configurable: { thread_id: threadId, checkpoint_id: record.parentCheckpointId } }
              : undefined,
            pendingWrites: record.writes
          };
        }
      } catch (err: any) {
        console.warn("[PersistentDurableSaver] MongoDB getTuple fallback to disk:", err.message);
      }
    }

    return undefined;
  }

  public async *list(
    config: RunnableConfig,
    options?: any
  ): AsyncGenerator<CheckpointTuple, void, unknown> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    const tuple = await this.getTuple(config);
    if (tuple) {
      yield tuple;
    }
  }

  public async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      throw new Error("PersistentDurableSaver: config.configurable.thread_id is required.");
    }

    const checkpointId = checkpoint.id;
    const parentCheckpointId = config.configurable?.checkpoint_id;

    // 1. Persist to durable disk storage (instant, local)
    try {
      const filePath = this.getFilePath(threadId);
      const payload = {
        threadId,
        checkpointId,
        parentCheckpointId,
        checkpoint,
        metadata,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err: any) {
      console.warn("[PersistentDurableSaver] Disk put error:", err.message);
    }

    // 2. Persist to MongoDB (non-blocking for fast graph execution)
    if (mongoose.connection.readyState === 1) {
      MongoCheckpoint.findOneAndUpdate(
        { threadId, checkpointId },
        {
          threadId,
          checkpointId,
          parentCheckpointId,
          checkpoint,
          metadata
        },
        { upsert: true, new: true }
      ).catch((err: any) => {
        console.warn("[PersistentDurableSaver] MongoDB put error:", err.message);
      });
    }

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_id: checkpointId
      }
    };
  }

  public async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) return;

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoCheckpoint.updateOne(
          { threadId, checkpointId: config.configurable?.checkpoint_id },
          { $push: { writes: { $each: writes } } }
        );
      } catch (err: any) {
        console.warn("[PersistentDurableSaver] MongoDB putWrites error:", err.message);
      }
    }
  }
}

export const defaultCheckpointer = new PersistentDurableSaver();
