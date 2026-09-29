import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IApproval extends MongooseDocument {
  threadId: string;
  workflowRunId: mongoose.Types.ObjectId;
  draft: string;
  citations: Array<{ chunkId: string; quote: string }>;
  status: "pending" | "approved" | "rejected";
  feedback?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  revisionCount: number;
}

const ApprovalSchema = new Schema<IApproval>(
  {
    threadId: { 
      type: String, 
      required: true, 
      index: true 
    },

    workflowRunId: { 
      type: Schema.Types.ObjectId, 
      ref: "WorkflowRun", 
      required: true 
    },
    
    draft: { 
      type: String, 
      required: true 
    },
    
    citations: [
      {
        chunkId: { type: String },
        quote: { type: String }
      }
    ],
    
    status: { 
      type: String, 
      enum: ["pending", "approved", "rejected"], 
      default: "pending", 
      index: true 
    },
    
    feedback: { 
      type: String 
    },
    
    reviewedBy: { 
      type: String, 
      default: "human-reviewer" 
    },
    
    reviewedAt: { type: Date },
    
    revisionCount: { 
      type: Number, 
      default: 0 
    }
  },
  { timestamps: true }
);

export const Approval = mongoose.model<IApproval>("Approval", ApprovalSchema);
