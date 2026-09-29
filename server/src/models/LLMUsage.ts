import mongoose, { Schema } from "mongoose";

export interface ILLMUsage {
  threadId?: string;
  provider: string;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  createdAt: Date;
}

const LLMUsageSchema = new Schema<ILLMUsage>(
  {
    threadId: { 
      type: String, 
      index: true 
    },

    provider: { 
      type: String, 
      required: true 
    },

    model: { 
      type: String, 
      required: true 
    },

    operation: { 
      type: String, 
      default: "chat" 
    },

    promptTokens: { 
      type: Number, 
      default: 0 
    },

    completionTokens: { 
      type: Number, 
      default: 0 
    },

    totalTokens: { 
      type: Number, 
      default: 0 
    },

    costUsd: { 
      type: Number, 
      default: 0 
    },

    latencyMs: { 
      type: Number, 
      default: 0 
    },

    success: { 
      type: Boolean, 
      default: true 
    },
    
    error: { 
      type: String 
    }
  },
  { timestamps: true }
);

export const LLMUsage = mongoose.model<ILLMUsage>("LLMUsage", LLMUsageSchema);
