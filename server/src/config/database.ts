import mongoose from "mongoose";
import { env } from "./env.js";

let mongodInstance: any = null;

export async function connectDatabase(): Promise<string> {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection.host;
  }

  let uri : string | undefined = env.MONGODB_URI;

  if (!uri) {
    if (process.env.VERCEL) {
      throw new Error(
        "Missing MONGODB_URI environment variable. When deploying to Vercel, a cloud MongoDB connection string (e.g., MongoDB Atlas) is required."
      );
    }

    try {
      // Lazy load mongodb-memory-server to avoid native binary issues if not needed
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      
      mongodInstance = await MongoMemoryServer.create();
      
      uri = mongodInstance.getUri();
      
      console.log(`[Database] Initialized In-Memory MongoDB at ${uri}`);
    
    } catch (err) {
      console.warn("[Database] MongoMemoryServer initialization fallback:", err);
      uri = "mongodb://127.0.0.1:27017/support_assistant";
    }
  }

  try {
    await mongoose.connect(uri as string);
    
    console.log(`[Database] Connected successfully to MongoDB (${uri?.split("@").pop()?.split("?")[0]})`);

    return uri as string;
  
  } catch (error) {
    console.error("[Database] Connection failed:", error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}
