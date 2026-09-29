import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IWorkflowRun extends MongooseDocument {
  threadId: string;
  question: string;
  status: "pending" | "processing" | "waiting_approval" | "approved" | "rejected" | "completed" | "failed";
  currentStep: string;
  category?: string;
  draft?: string;
  citations?: Array<{ chunkId: string; quote: string }>;
  confidence?: number;
  revisionCount: number;
  reviewerFeedback?: string;
  sent: boolean;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    threadId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },

    question: { 
      type: String, 
      required: true 
    },

    status: {
      type: String,
      enum: ["pending", "processing", "waiting_approval", "approved", "rejected", "completed", "failed"],
      default: "pending",
      index: true
    },

    currentStep: { 
      type: String, 
      default: "init" 
    },

    category: { 
      type: String 
    },

    draft: { 
      type: String 
    },

    citations: [
      {
        chunkId: { type: String },
        quote: { type: String }
      }
    ],

    confidence: { 
      type: Number 
    },

    revisionCount: { 
      type: Number, 
      default: 0 
    },
    
    reviewerFeedback: { 
      type: String 
    },

    sent: { 
      type: Boolean, 
      default: false 
    },

    totalTokens: { 
      type: Number, 
      default: 0 
    },

    estimatedCostUsd: { 
      type: Number, 
      default: 0 
    },
    
    latencyMs: { 
      type: Number, 
      default: 0 
    }
  },
  { timestamps: true }
);

export const WorkflowRun = mongoose.model<IWorkflowRun>("WorkflowRun", WorkflowRunSchema);
