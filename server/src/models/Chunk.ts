import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IChunk extends MongooseDocument {
  chunkId: string;
  documentId: string;
  documentName: string;
  section: string;
  page: number;
  text: string;
  tokenCount: number;
  embedding?: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ChunkSchema = new Schema<IChunk>(
  {
    chunkId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    
    documentId: { 
      type: String, 
      required: true, 
      index: true 
    },
    
    documentName: { 
      type: String, 
      required: true 
    },
    
    section: { 
      type: String, 
      default: "General" 
    },
    
    page: { 
      type: Number, 
      default: 1 
    },

    text: { 
      type: String, 
      required: true 
    },

    tokenCount: { 
      type: Number, 
      default: 0 
    },

    embedding: { 
      type: [Number], 
      select: false 
    },

    metadata: { 
      type: Schema.Types.Mixed, 
      default: {} 
    }
  },
  { timestamps: true }
);

export const Chunk = mongoose.model<IChunk>("Chunk", ChunkSchema);
