import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IDocument extends MongooseDocument {
  documentId: string;
  title: string;
  filename: string;
  category: string;
  chunkCount: number;
  status: "pending" | "indexed" | "failed";
  uploadedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    documentId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    
    title: { 
      type: String, 
      required: true 
    },
    
    filename: { 
      type: String, 
      required: true 
    },
    
    category: { 
      type: String, 
      default: "general" 
    },
    
    chunkCount: { 
      type: Number, 
      default: 0 
    },
    
    status: { 
      type: String, 
      enum: ["pending", "indexed", "failed"], 
      default: "indexed" 
    },
    
    uploadedAt: { 
      type: Date, 
      default: Date.now 
    }
  },
  { timestamps: true }
);

export const Document = mongoose.model<IDocument>("Document", DocumentSchema);
