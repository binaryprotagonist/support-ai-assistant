import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IEvaluation extends MongooseDocument {
  runType: "retrieval" | "answer" | "composite" | "live_traffic";
  metrics: Record<string, any>;
  score: number;
  sampleCount: number;
  details?: any;
  createdAt: Date;
}

const EvaluationSchema = new Schema<IEvaluation>(
  {
    runType: { 
      type: String, 
      required: true 
    },
    
    metrics: { 
      type: Schema.Types.Mixed, 
      required: true 
    },
    
    score: { 
      type: Number, 
      required: true 
    },
    
    sampleCount: { 
      type: Number, 
      required: true 
    },
    
    details: { 
      type: Schema.Types.Mixed 
    }
  },
  { timestamps: true }
);

export const Evaluation = mongoose.model<IEvaluation>("Evaluation", EvaluationSchema);
